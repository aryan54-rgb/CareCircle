import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';
import { Role } from '../../lib/validate.js';

export type SuggestionType = 'NEW_MED' | 'CHANGE_MED' | 'APPOINTMENT';
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface SuggestionItem {
  id: string;
  circleId: string;
  type: SuggestionType;
  title: string;
  payload: Record<string, any>;
  proposedBy: string;
  proposedByName: string;
  proposedByRole: Role;
  status: SuggestionStatus;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
}

export const suggestionRepo = {
  async create(data: {
    circleId: string;
    type: SuggestionType;
    title: string;
    payload: Record<string, any>;
    proposedBy: string;
    proposedByName: string;
    proposedByRole: Role;
  }): Promise<SuggestionItem> {
    const id = Math.random().toString(36).substring(2, 10);
    const createdAt = new Date().toISOString();

    const item: SuggestionItem = {
      id,
      circleId: data.circleId,
      type: data.type,
      title: data.title,
      payload: data.payload,
      proposedBy: data.proposedBy,
      proposedByName: data.proposedByName,
      proposedByRole: data.proposedByRole,
      status: 'PENDING',
      createdAt,
    };

    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.suggestion(data.circleId, createdAt, id),
          ...item,
        },
      })
    );

    return item;
  },

  async listByCircle(circleId: string): Promise<SuggestionItem[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skPrefix': 'S#',
        },
        ScanIndexForward: false, // newest first
      })
    );

    return (res.Items || []) as SuggestionItem[];
  },

  async get(circleId: string, id: string): Promise<{ item: SuggestionItem; SK: string } | null> {
    const all = await this.listByCircle(circleId);
    const found = all.find((s) => s.id === id);
    if (!found) return null;
    return {
      item: found,
      SK: `S#${found.createdAt}#${found.id}`,
    };
  },

  async updateStatus(
    circleId: string,
    sk: string,
    status: 'APPROVED' | 'DECLINED',
    decidedBy: string,
    decidedByName: string,
    decisionNote?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: {
          PK: `C#${circleId}`,
          SK: sk,
        },
        UpdateExpression:
          'SET #s = :status, decidedBy = :by, decidedByName = :byName, decidedAt = :now, decisionNote = :note',
        ExpressionAttributeNames: {
          '#s': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':by': decidedBy,
          ':byName': decidedByName,
          ':now': now,
          ':note': decisionNote || '',
        },
      })
    );
  },
};
