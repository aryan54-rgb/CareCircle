import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';
import { Role } from '../../lib/validate.js';

export interface Member {
  memberId: string;
  circleId: string;
  name: string;
  email: string;
  role: Role;
  passcodeHash: string;
  notifyPrefs?: {
    email?: boolean;
    sms?: boolean;
  };
  createdAt: string;
}

export const memberRepo = {
  async get(circleId: string, memberId: string): Promise<Member | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.member(circleId, memberId),
      })
    );
    if (!res.Item) return null;
    return {
      memberId: res.Item.memberId,
      circleId: res.Item.circleId,
      name: res.Item.name,
      email: res.Item.email,
      role: res.Item.role,
      passcodeHash: res.Item.passcodeHash,
      notifyPrefs: res.Item.notifyPrefs,
      createdAt: res.Item.createdAt,
    };
  },

  async create(member: Omit<Member, 'createdAt'>): Promise<Member> {
    const item: Member = {
      ...member,
      createdAt: new Date().toISOString(),
    };
    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.member(member.circleId, member.memberId),
          ...item,
        },
      })
    );
    return item;
  },

  async listByCircle(circleId: string): Promise<Omit<Member, 'passcodeHash'>[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `C#${circleId}`,
          ':skPrefix': 'M#',
        },
      })
    );

    return (res.Items || []).map((item) => ({
      memberId: item.memberId,
      circleId: item.circleId,
      name: item.name,
      email: item.email,
      role: item.role,
      notifyPrefs: item.notifyPrefs,
      createdAt: item.createdAt,
    }));
  },
};
