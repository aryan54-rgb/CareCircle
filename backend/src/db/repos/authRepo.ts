import { GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../client.js';
import { Keys } from '../keys.js';
import { config } from '../../lib/config.js';
import { Role } from '../../lib/validate.js';
import { toEpochSeconds, addMinutes } from '../../lib/time.js';

export interface LoginLookup {
  circleId: string;
  memberId: string;
}

export interface Invite {
  code: string;
  circleId: string;
  role: Role;
  expiresAt: string;
  usedAt?: string;
  usedBy?: string;
  ttl: number;
}

export const authRepo = {
  async getLoginLookup(email: string): Promise<LoginLookup | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.loginLookup(email),
      })
    );
    if (!res.Item) return null;
    return {
      circleId: res.Item.circleId,
      memberId: res.Item.memberId,
    };
  },

  async setLoginLookup(email: string, circleId: string, memberId: string): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.loginLookup(email),
          circleId,
          memberId,
          createdAt: new Date().toISOString(),
        },
      })
    );
  },

  async getFailedAttempts(email: string): Promise<{ count: number; lockedUntil?: number } | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.loginAttempts(email),
      })
    );
    if (!res.Item) return null;
    return {
      count: res.Item.count || 0,
      lockedUntil: res.Item.ttl,
    };
  },

  async recordFailedAttempt(email: string): Promise<number> {
    const lockoutUntilEpoch = toEpochSeconds(addMinutes(new Date(), 15));
    const res = await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.loginAttempts(email),
        UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :one, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#c': 'count',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':ttl': lockoutUntilEpoch,
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    return res.Attributes?.count || 1;
  },

  async clearFailedAttempts(email: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: config.tableName,
        Key: Keys.loginAttempts(email),
      })
    );
  },

  async getInvite(code: string): Promise<Invite | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.invite(code),
      })
    );
    if (!res.Item) return null;
    return {
      code: res.Item.code,
      circleId: res.Item.circleId,
      role: res.Item.role,
      expiresAt: res.Item.expiresAt,
      usedAt: res.Item.usedAt,
      usedBy: res.Item.usedBy,
      ttl: res.Item.ttl,
    };
  },

  async createInvite(code: string, circleId: string, role: Role, expiresAt: string): Promise<void> {
    const ttl = toEpochSeconds(expiresAt);
    await docClient.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          ...Keys.invite(code),
          code,
          circleId,
          role,
          expiresAt,
          ttl,
          createdAt: new Date().toISOString(),
        },
      })
    );
  },

  async markInviteUsed(code: string, memberId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.invite(code),
        UpdateExpression: 'SET usedAt = :now, usedBy = :memberId',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
          ':memberId': memberId,
        },
      })
    );
  },
};
