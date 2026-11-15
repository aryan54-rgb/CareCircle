import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';
import { GeneratedDose } from '../../domain/scheduleGenerator.js';

export type DoseStatus =
  | 'SCHEDULED'
  | 'REMINDED'
  | 'ESCALATED_1'
  | 'ESCALATED_2'
  | 'TAKEN'
  | 'SKIPPED'
  | 'MISSED';

export interface DoseItem {
  id: string; // `${dueAt}#${medId}`
  circleId: string;
  medId: string;
  medName: string;
  dueAt: string; // UTC ISO
  status: DoseStatus;
  nextActionAt?: string; // UTC ISO
  takenAt?: string;
  takenBy?: string;
  takenByName?: string;
  skippedAt?: string;
  skippedBy?: string;
  GSI1PK?: 'OPEN';
  GSI1SK?: string;
  createdAt: string;
  updatedAt: string;
}

export function toDoseId(dueAt: string, medId: string): string {
  return Buffer.from(`${dueAt}#${medId}`).toString('base64url');
}

export function parseDoseId(rawId: string): { dueAt: string; medId: string } {
  const decoded = decodeURIComponent(rawId);
  // 1. If base64url (no colons or hashes)
  if (!decoded.includes(':') && !decoded.includes('#')) {
    try {
      const unbased = Buffer.from(decoded, 'base64url').toString('utf-8');
      const hashIdx = unbased.indexOf('#');
      if (hashIdx !== -1) {
        return {
          dueAt: unbased.substring(0, hashIdx),
          medId: unbased.substring(hashIdx + 1),
        };
      }
    } catch {}
  }
  // 2. If contains '_' separator
  if (decoded.includes('_')) {
    const idx = decoded.indexOf('_');
    return { dueAt: decoded.substring(0, idx), medId: decoded.substring(idx + 1) };
  }
  // 3. If contains '#' separator
  const hashIdx = decoded.indexOf('#');
  if (hashIdx !== -1) {
    return { dueAt: decoded.substring(0, hashIdx), medId: decoded.substring(hashIdx + 1) };
  }
  throw new Error('Invalid dose ID');
}

export const doseRepo = {
  /**
   * Save a batch of generated doses to DynamoDB
   */
  async batchCreate(doses: GeneratedDose[]): Promise<void> {
    if (doses.length === 0) return;
    const now = new Date().toISOString();

    // DynamoDB BatchWriteItem supports max 25 items per batch
    for (let i = 0; i < doses.length; i += 25) {
      const chunk = doses.slice(i, i + 25);
      const putRequests = chunk.map((d) => {
        const id = toDoseId(d.dueAt, d.medId);
        const item: DoseItem = {
          id,
          circleId: d.circleId,
          medId: d.medId,
          medName: d.medName,
          dueAt: d.dueAt,
          status: d.status,
          nextActionAt: d.nextActionAt,
          GSI1PK: d.GSI1PK,
          GSI1SK: d.GSI1SK,
          createdAt: now,
          updatedAt: now,
        };
        return {
          PutRequest: {
            Item: {
              ...Keys.dose(d.circleId, d.dueAt, d.medId),
              ...item,
            },
          },
        };
      });

      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [config.tableName]: putRequests,
          },
        })
      );
    }
  },


  /**
   * Finds future SCHEDULED doses for a medication and deletes them (for editing/deactivation)
   */
  async deleteFutureScheduled(circleId: string, medId: string, fromISO: string): Promise<number> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND SK >= :skStart',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skStart': `D#${fromISO}`,
        },
      })
    );

    const itemsToDelete = (res.Items || []).filter(
      (item) => item.medId === medId && item.status === 'SCHEDULED'
    );

    for (const item of itemsToDelete) {
      await docClient.send(
        new DeleteCommand({
          TableName: config.tableName,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        })
      );
    }

    return itemsToDelete.length;
  },

  /**
   * Query doses for a date range in UTC (spans a full 24h day in local timezone)
   */
  async listByRange(circleId: string, startUTC: string, endUTC: string): Promise<DoseItem[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skStart': `D#${startUTC}`,
          ':skEnd': `D#${endUTC}~`,
        },
      })
    );

    return (res.Items || []).map((item) => ({
      id: item.id || toDoseId(item.dueAt, item.medId),
      circleId: item.circleId,
      medId: item.medId,
      medName: item.medName,
      dueAt: item.dueAt,
      status: item.status,
      nextActionAt: item.nextActionAt,
      takenAt: item.takenAt,
      takenBy: item.takenBy,
      takenByName: item.takenByName,
      skippedAt: item.skippedAt,
      skippedBy: item.skippedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  },

  /**
   * Get single dose by circleId and doseId (`${dueAt}#${medId}`)
   */
  async get(circleId: string, doseId: string): Promise<DoseItem | null> {
    // Decode doseId if it contains URL encoding
    const decodedId = decodeURIComponent(doseId);
    const hashIndex = decodedId.indexOf('#');
    if (hashIndex === -1) return null;

    const dueAt = decodedId.substring(0, hashIndex);
    const medId = decodedId.substring(hashIndex + 1);

    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.dose(circleId, dueAt, medId),
      })
    );

    if (!res.Item) return null;
    return res.Item as DoseItem;
  },

  /**
   * Mark dose as TAKEN: update status, record actor, and REMOVE GSI1 sparse keys
   */
  async markTaken(
    circleId: string,
    dueAt: string,
    medId: string,
    takenBy: string,
    takenByName: string
  ): Promise<DoseItem | null> {
    const now = new Date().toISOString();
    const res = await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.dose(circleId, dueAt, medId),
        UpdateExpression:
          'SET #s = :taken, takenAt = :now, takenBy = :by, takenByName = :byName, updatedAt = :now REMOVE GSI1PK, GSI1SK',
        ExpressionAttributeNames: {
          '#s': 'status',
        },
        ExpressionAttributeValues: {
          ':taken': 'TAKEN',
          ':now': now,
          ':by': takenBy,
          ':byName': takenByName,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return res.Attributes as DoseItem;
  },

  /**
   * Mark dose as SKIPPED: update status, record actor, and REMOVE GSI1 sparse keys
   */
  async markSkipped(
    circleId: string,
    dueAt: string,
    medId: string,
    skippedBy: string,
    skippedByName: string
  ): Promise<DoseItem | null> {
    const now = new Date().toISOString();
    const res = await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.dose(circleId, dueAt, medId),
        UpdateExpression:
          'SET #s = :skipped, skippedAt = :now, skippedBy = :by, skippedByName = :byName, updatedAt = :now REMOVE GSI1PK, GSI1SK',
        ExpressionAttributeNames: {
          '#s': 'status',
        },
        ExpressionAttributeValues: {
          ':skipped': 'SKIPPED',
          ':now': now,
          ':by': skippedBy,
          ':byName': skippedByName,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return res.Attributes as DoseItem;
  },
};
