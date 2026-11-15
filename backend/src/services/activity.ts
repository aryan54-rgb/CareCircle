import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { nowISO } from '../lib/time.js';

export interface ActivityItem {
  id: string;
  circleId: string;
  actorId: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

export const activityService = {
  async log(params: {
    circleId: string;
    actorId: string;
    actorName: string;
    action: string;
    summary: string;
  }): Promise<ActivityItem> {
    const id = Math.random().toString(36).substring(2, 9);
    const createdAt = nowISO();
    const item: ActivityItem = {
      id,
      circleId: params.circleId,
      actorId: params.actorId,
      actorName: params.actorName,
      action: params.action,
      summary: params.summary,
      createdAt,
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: config.tableName,
          Item: {
            ...Keys.activity(params.circleId, createdAt, id),
            ...item,
          },
        })
      );
    } catch (err) {
      console.error('Failed to log activity:', err);
    }

    return item;
  },

  async list(circleId: string, limit: number = 30): Promise<ActivityItem[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skPrefix': 'L#',
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );

    return (res.Items || []).map((item) => ({
      id: item.id,
      circleId: item.circleId,
      actorId: item.actorId,
      actorName: item.actorName,
      action: item.action,
      summary: item.summary,
      createdAt: item.createdAt,
    }));
  },
};
