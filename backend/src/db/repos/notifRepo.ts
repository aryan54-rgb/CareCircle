import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { docClient } from '../client.js';
import { config } from '../../lib/config.js';

export interface NotificationItem {
  id: string;
  circleId: string;
  to: string;
  subject: string;
  stage: string;
  success: boolean;
  error?: string;
  sentAt: string; // UTC ISO
  ttl?: number; // epoch seconds (7 days retention)
}

export const notifRepo = {
  /**
   * Records an email delivery attempt with TTL
   */
  async create(data: {
    circleId: string;
    to: string;
    subject: string;
    stage: string;
    success: boolean;
    error?: string;
  }): Promise<NotificationItem> {
    const id = crypto.randomUUID();
    const sentAt = new Date().toISOString();
    // 7 days retention TTL
    const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    const item: NotificationItem = {
      id,
      circleId: data.circleId,
      to: data.to,
      subject: data.subject,
      stage: data.stage,
      success: data.success,
      error: data.error,
      sentAt,
      ttl,
    };

    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          PK: `C#${data.circleId}`,
          SK: `NOTIF#${sentAt}#${id}`,
          ...item,
        },
      })
    );

    return item;
  },

  /**
   * Retrieves recent notification delivery records for a circle (latest first)
   */
  async listByCircle(circleId: string, limit: number = 50): Promise<NotificationItem[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skPrefix': 'NOTIF#',
        },
        ScanIndexForward: false, // Newest first
        Limit: limit,
      })
    );

    return (res.Items || []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      circleId: i.circleId as string,
      to: i.to as string,
      subject: i.subject as string,
      stage: i.stage as string,
      success: Boolean(i.success),
      error: i.error as string | undefined,
      sentAt: i.sentAt as string,
      ttl: i.ttl as number | undefined,
    }));
  },
};
