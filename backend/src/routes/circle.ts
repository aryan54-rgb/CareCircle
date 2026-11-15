import crypto from 'crypto';
import { Hono } from 'hono';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, GetAccountCommand, GetEmailIdentityCommand } from '@aws-sdk/client-sesv2';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { authRepo } from '../db/repos/authRepo.js';
import { notifRepo } from '../db/repos/notifRepo.js';
import { activityService } from '../services/activity.js';
import { requireAuth, requireRoles } from '../lib/middleware.js';
import { createInviteSchema, updateSettingsSchema } from '../lib/validate.js';
import { Errors } from '../lib/errors.js';
import { addDays, nowISO } from '../lib/time.js';

const circleRoutes = new Hono();

circleRoutes.use('*', requireAuth);

/**
 * GET /me
 * Return current member profile
 */
circleRoutes.get('/me', async (c) => {
  const user = c.get('user');
  const member = await memberRepo.get(user.circleId, user.memberId);
  if (!member) throw Errors.notFound('Member not found');
  return c.json({
    memberId: member.memberId,
    circleId: member.circleId,
    name: member.name,
    email: member.email,
    role: member.role,
  });
});

/**
 * GET /circle
 * Return circle metadata, members, and settings
 */
circleRoutes.get('/circle', async (c) => {
  const user = c.get('user');
  const [circle, members] = await Promise.all([
    circleRepo.get(user.circleId),
    memberRepo.listByCircle(user.circleId),
  ]);

  if (!circle) throw Errors.notFound('Circle not found');

  return c.json({
    circle,
    members: members.map((m) => ({
      memberId: m.memberId,
      name: m.name,
      email: m.email,
      role: m.role,
    })),
  });
});

/**
 * PATCH /circle/settings
 * Caretaker only: update escalation delays, demo mode, timezone
 */
circleRoutes.patch('/circle/settings', requireRoles(['CARETAKER']), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const updatedSettings = await circleRepo.updateSettings(user.circleId, parsed.data);

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName: 'Caretaker',
    action: 'UPDATE_SETTINGS',
    summary: 'Updated circle settings and escalation parameters.',
  });

  return c.json({
    settings: updatedSettings,
  });
});

/**
 * POST /circle/invites
 * Caretaker only: generate a 6-character invite code valid for 48 hours
 */
circleRoutes.post('/circle/invites', requireRoles(['CARETAKER']), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  // Generate clean 6-character code using cryptographically secure random integers
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }

  const expiresAt = addDays(new Date(), 2).toISOString(); // 48 hours
  await authRepo.createInvite(code, user.circleId, parsed.data.role, expiresAt);

  return c.json({
    code,
    role: parsed.data.role,
    expiresAt,
  });
});

/**
 * GET /activity
 * Return recent activity log for the circle
 */
circleRoutes.get('/activity', async (c) => {
  const user = c.get('user');
  const items = await activityService.list(user.circleId);
  return c.json({
    activities: items,
  });
});

/**
 * GET /circle/notifications
 * Return notification delivery history (for caretakers and judges)
 */
circleRoutes.get('/circle/notifications', requireRoles(['CARETAKER']), async (c) => {
  const user = c.get('user');
  const items = await notifRepo.listByCircle(user.circleId);
  return c.json({
    notifications: items,
  });
});

// Cache Bedrock check for 5 minutes (300,000 ms) to avoid quota burn and latency
let cachedBedrockHealth: { status: 'ok' | 'error'; message: string; timestamp: number } | null = null;
const BEDROCK_CACHE_MS = 5 * 60 * 1000;

/**
 * GET /health/deep
 * Deep health verification of DynamoDB, SES, and Bedrock.
 * Requires CARETAKER auth. Caches Bedrock check for 5 minutes.
 */
circleRoutes.get('/health/deep', requireRoles(['CARETAKER']), async (c) => {
  const user = c.get('user');

  // 1. DynamoDB Check
  const startDb = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;
  try {
    await docClient.send(
      new GetCommand({
        TableName: config.tableName,
        Key: Keys.circleMeta(user.circleId),
      })
    );
    dbLatencyMs = Date.now() - startDb;
  } catch (err: unknown) {
    dbStatus = err instanceof Error ? err.message : String(err);
  }

  // 2. SES Status Check
  let sesStatus = 'ok';
  let sesSendingEnabled = true;
  let sesProductionAccess = false;
  let sesIdentityVerified = false;
  try {
    const sesClient = new SESv2Client({ region: config.awsRegion });
    const [accountRes, identityRes] = await Promise.all([
      sesClient.send(new GetAccountCommand({})),
      sesClient.send(new GetEmailIdentityCommand({ EmailIdentity: config.sesFrom })).catch(() => null),
    ]);
    sesSendingEnabled = accountRes.SendingEnabled ?? true;
    sesProductionAccess = accountRes.ProductionAccessEnabled ?? false;
    sesIdentityVerified = identityRes?.VerificationStatus === 'SUCCESS';
  } catch (err: unknown) {
    sesStatus = err instanceof Error ? err.message : String(err);
  }

  // 3. Bedrock Converse Check (cached 5 min)
  const now = Date.now();
  if (!cachedBedrockHealth || now - cachedBedrockHealth.timestamp >= BEDROCK_CACHE_MS) {
    try {
      const bedrockClient = new BedrockRuntimeClient({ region: config.bedrockRegion });
      await bedrockClient.send(
        new ConverseCommand({
          modelId: config.bedrockModelId,
          messages: [{ role: 'user', content: [{ text: 'ping' }] }],
          inferenceConfig: { maxTokens: 1, temperature: 0.1 },
        })
      );
      cachedBedrockHealth = {
        status: 'ok',
        message: `Model ${config.bedrockModelId} active`,
        timestamp: now,
      };
    } catch (err: unknown) {
      cachedBedrockHealth = {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
        timestamp: now,
      };
    }
  }

  const overallHealthy =
    dbStatus === 'ok' &&
    sesStatus === 'ok' &&
    cachedBedrockHealth.status === 'ok';

  return c.json({
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: nowISO(),
    services: {
      dynamodb: {
        status: dbStatus,
        tableName: config.tableName,
        region: config.awsRegion,
        latencyMs: dbLatencyMs,
      },
      ses: {
        status: sesStatus,
        fromEmail: config.sesFrom,
        sendingEnabled: sesSendingEnabled,
        productionAccess: sesProductionAccess,
        identityVerified: sesIdentityVerified,
        isSandbox: !sesProductionAccess,
      },
      bedrock: {
        status: cachedBedrockHealth.status,
        modelId: config.bedrockModelId,
        region: config.bedrockRegion,
        message: cachedBedrockHealth.message,
        cached: now - cachedBedrockHealth.timestamp > 1000,
      },
    },
  });
});

export { circleRoutes };
