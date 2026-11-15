import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';

export interface CircleSettings {
  preMinutes: number;
  escalate1Minutes: number;
  escalate2Minutes: number;
  missedMinutes: number;
  appointmentReminders: number[];
  demoMode: boolean;
  timezone: string;
}

export const DEFAULT_CIRCLE_SETTINGS: CircleSettings = {
  preMinutes: 10,
  escalate1Minutes: 15,
  escalate2Minutes: 30,
  missedMinutes: 60,
  appointmentReminders: [1440, 120],
  demoMode: true,
  timezone: 'Asia/Kolkata',
};

export const DEMO_CIRCLE_SETTINGS: CircleSettings = {
  preMinutes: 0,
  escalate1Minutes: 1,
  escalate2Minutes: 2,
  missedMinutes: 3,
  appointmentReminders: [1440, 120],
  demoMode: true,
  timezone: 'Asia/Kolkata',
};

export interface Circle {
  circleId: string;
  name: string;
  elderName: string;
  timezone: string;
  settings: CircleSettings;
  createdAt: string;
}

export const circleRepo = {
  async get(circleId: string): Promise<Circle | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.circleMeta(circleId),
      })
    );
    if (!res.Item) return null;
    return {
      circleId: res.Item.circleId,
      name: res.Item.name,
      elderName: res.Item.elderName,
      timezone: res.Item.timezone || 'Asia/Kolkata',
      settings: res.Item.settings || DEFAULT_CIRCLE_SETTINGS,
      createdAt: res.Item.createdAt,
    };
  },

  async create(circle: Omit<Circle, 'createdAt'>): Promise<Circle> {
    const item: Circle = {
      ...circle,
      createdAt: new Date().toISOString(),
    };
    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.circleMeta(circle.circleId),
          ...item,
        },
      })
    );
    return item;
  },

  async updateSettings(circleId: string, partialSettings: Partial<CircleSettings>): Promise<CircleSettings> {
    const existing = await this.get(circleId);
    const newSettings = {
      ...(existing?.settings || DEFAULT_CIRCLE_SETTINGS),
      ...partialSettings,
    };

    await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.circleMeta(circleId),
        UpdateExpression: 'SET settings = :s',
        ExpressionAttributeValues: {
          ':s': newSettings,
        },
      })
    );

    return newSettings;
  },
};
