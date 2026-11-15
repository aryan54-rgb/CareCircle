import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';
import { addMinutes } from '../../lib/time.js';

export type AppointmentStage = 'SCHEDULED' | 'REMIND_24H' | 'REMIND_2H' | 'DONE';

export interface AppointmentItem {
  id: string; // `${startsAt}#${apptId}`
  apptId: string;
  circleId: string;
  doctor: string;
  place: string;
  notes?: string;
  startsAt: string; // UTC ISO
  stage: AppointmentStage;
  nextActionAt?: string; // UTC ISO
  GSI1PK?: 'OPEN';
  GSI1SK?: string;
  createdAt: string;
  updatedAt: string;
}

export function toApptId(startsAt: string, apptId: string): string {
  return Buffer.from(`${startsAt}#${apptId}`).toString('base64url');
}

export function parseApptId(rawId: string): { startsAt: string; apptId: string } {
  const decoded = decodeURIComponent(rawId);
  if (!decoded.includes(':') && !decoded.includes('#')) {
    try {
      const unbased = Buffer.from(decoded, 'base64url').toString('utf-8');
      const hashIdx = unbased.indexOf('#');
      if (hashIdx !== -1) {
        return {
          startsAt: unbased.substring(0, hashIdx),
          apptId: unbased.substring(hashIdx + 1),
        };
      }
    } catch {}
  }
  const hashIdx = decoded.indexOf('#');
  if (hashIdx !== -1) {
    return {
      startsAt: decoded.substring(0, hashIdx),
      apptId: decoded.substring(hashIdx + 1),
    };
  }
  throw new Error('Invalid appointment ID');
}

export const apptRepo = {
  async create(data: {
    circleId: string;
    doctor: string;
    place: string;
    notes?: string;
    startsAt: string;
    remind24hMinutes?: number; // default 1440
  }): Promise<AppointmentItem> {
    const apptId = Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const remind24hMins = data.remind24hMinutes ?? 1440;
    const nextActionAt = addMinutes(data.startsAt, -remind24hMins).toISOString();
    const id = toApptId(data.startsAt, apptId);

    const item: AppointmentItem = {
      id,
      apptId,
      circleId: data.circleId,
      doctor: data.doctor,
      place: data.place,
      notes: data.notes,
      startsAt: data.startsAt,
      stage: 'SCHEDULED',
      nextActionAt,
      GSI1PK: 'OPEN',
      GSI1SK: nextActionAt,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.appointment(data.circleId, data.startsAt, apptId),
          ...item,
        },
      })
    );

    return item;
  },

  async listByCircle(circleId: string): Promise<AppointmentItem[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skPrefix': 'A#',
        },
      })
    );

    return (res.Items || []).map((item) => ({
      id: item.id || toApptId(item.startsAt, item.apptId),
      apptId: item.apptId,
      circleId: item.circleId,
      doctor: item.doctor,
      place: item.place,
      notes: item.notes,
      startsAt: item.startsAt,
      stage: item.stage,
      nextActionAt: item.nextActionAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  },

  async get(circleId: string, id: string): Promise<AppointmentItem | null> {
    const { startsAt, apptId } = parseApptId(id);
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.appointment(circleId, startsAt, apptId),
      })
    );
    if (!res.Item) return null;
    return res.Item as AppointmentItem;
  },

  async update(
    circleId: string,
    id: string,
    updates: Partial<Pick<AppointmentItem, 'doctor' | 'place' | 'notes' | 'startsAt'>>
  ): Promise<AppointmentItem | null> {
    const existing = await this.get(circleId, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    // If startsAt changed, recompute nextActionAt
    let nextActionAt = existing.nextActionAt;
    if (updates.startsAt && updates.startsAt !== existing.startsAt) {
      nextActionAt = addMinutes(updates.startsAt, -1440).toISOString();
    }

    const updatedItem: AppointmentItem = {
      ...existing,
      ...updates,
      nextActionAt,
      GSI1SK: existing.GSI1PK === 'OPEN' ? nextActionAt : undefined,
      updatedAt: now,
    };

    // If startsAt changed, delete old key and create new
    if (updates.startsAt && updates.startsAt !== existing.startsAt) {
      const { startsAt, apptId } = parseApptId(id);
      await docClient.send(
        new DeleteCommand({
          TableName: config.tableName,
          Key: Keys.appointment(circleId, startsAt, apptId),
        })
      );
      updatedItem.id = toApptId(updates.startsAt, existing.apptId);
      await docClient.send(
        new PutCommand({
          TableName: config.tableName,
          Item: {
            ...Keys.appointment(circleId, updates.startsAt, existing.apptId),
            ...updatedItem,
          },
        })
      );
    } else {
      const { startsAt, apptId } = parseApptId(id);
      await docClient.send(
        new PutCommand({
          TableName: config.tableName,
          Item: {
            ...Keys.appointment(circleId, startsAt, apptId),
            ...updatedItem,
          },
        })
      );
    }

    return updatedItem;
  },

  async delete(circleId: string, id: string): Promise<boolean> {
    const { startsAt, apptId } = parseApptId(id);
    await docClient.send(
      new DeleteCommand({
        TableName: config.tableName,
        Key: Keys.appointment(circleId, startsAt, apptId),
      })
    );
    return true;
  },
};
