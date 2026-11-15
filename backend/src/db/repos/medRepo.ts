import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';

export interface Medication {
  medId: string;
  circleId: string;
  name: string;
  strength: string;
  form: string;
  instructions: string;
  times: string[]; // ['09:00', '21:00']
  daysOfWeek: number[]; // [0, 1, 2, 3, 4, 5, 6]
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  pillCount?: number;
  refillThreshold?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const medRepo = {
  async get(circleId: string, medId: string): Promise<Medication | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.medication(circleId, medId),
      })
    );
    if (!res.Item) return null;
    return res.Item as Medication;
  },

  async create(med: Omit<Medication, 'createdAt' | 'updatedAt'>): Promise<Medication> {
    const now = new Date().toISOString();
    const item: Medication = {
      ...med,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.medication(med.circleId, med.medId),
          ...item,
        },
      })
    );
    return item;
  },

  async listByCircle(circleId: string, activeOnly: boolean = false): Promise<Medication[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skPrefix': 'MED#',
        },
      })
    );

    const items = (res.Items || []) as Medication[];
    if (activeOnly) {
      return items.filter((m) => m.active);
    }
    return items;
  },

  async update(
    circleId: string,
    medId: string,
    updates: Partial<Omit<Medication, 'medId' | 'circleId' | 'createdAt'>>
  ): Promise<Medication | null> {
    const existing = await this.get(circleId, medId);
    if (!existing) return null;

    const updated: Medication = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.medication(circleId, medId),
          ...updated,
        },
      })
    );

    return updated;
  },

  async decrementPillCount(circleId: string, medId: string): Promise<number | undefined> {
    const med = await this.get(circleId, medId);
    if (!med || typeof med.pillCount !== 'number') return undefined;

    const newCount = Math.max(0, med.pillCount - 1);
    await this.update(circleId, medId, { pillCount: newCount });
    return newCount;
  },
};
