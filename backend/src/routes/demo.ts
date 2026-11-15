import { Hono } from 'hono';
import { circleRepo, DEMO_CIRCLE_SETTINGS } from '../db/repos/circleRepo.js';
import { doseRepo, parseDoseId } from '../db/repos/doseRepo.js';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { requireAuth, requireRoles } from '../lib/middleware.js';
import { addMinutes } from '../lib/time.js';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Errors } from '../lib/errors.js';
import { seedDemoCircle } from '../services/demoSeed.js';
import { runWeeklyDigest } from '../handlers/digest.js';

const demoRoutes = new Hono();

// Enforce authentication, CARETAKER role, and DEMO_MODE on all /demo endpoints
demoRoutes.use('*', requireAuth);
demoRoutes.use('*', requireRoles(['CARETAKER']));
demoRoutes.use('*', async (c, next) => {
  if (!config.isDemoMode) {
    throw Errors.forbidden('Demo mode is disabled');
  }
  await next();
});

/**
 * POST /demo/trigger-missed
 * Forces an open dose into due state under demo timing
 * (pre=0, e1=1min, e2=2min, missed=3min) so escalations happen in real-time
 */
demoRoutes.post('/trigger-missed', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  // 1. Switch circle settings to rapid demo mode
  await circleRepo.updateSettings(user.circleId, DEMO_CIRCLE_SETTINGS);

  // 2. Locate or select a dose to trigger
  let targetDose;
  if (body.doseId) {
    targetDose = await doseRepo.get(user.circleId, body.doseId);
  } else {
    // Pick first open dose from today
    const now = new Date();
    const startStr = addMinutes(now, -60).toISOString();
    const endStr = addMinutes(now, 1440).toISOString();
    const doses = await doseRepo.listByRange(user.circleId, startStr, endStr);
    targetDose = doses.find((d) => d.status === 'SCHEDULED' || d.status === 'REMINDED');
  }

  if (!targetDose) {
    throw Errors.notFound('No open scheduled dose found to trigger. Please add a medication first.');
  }

  // 3. Backdate dueAt and nextActionAt to trigger immediately
  const now = new Date();
  const pastDue = addMinutes(now, -1).toISOString();
  const { dueAt, medId } = parseDoseId(targetDose.id);

  await docClient.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: Keys.dose(user.circleId, dueAt, medId),
      UpdateExpression: 'SET dueAt = :pastDue, nextActionAt = :pastDue, GSI1SK = :pastDue, updatedAt = :now',
      ExpressionAttributeValues: {
        ':pastDue': pastDue,
        ':now': now.toISOString(),
      },
    })
  );

  return c.json({
    success: true,
    message: 'Demo dose backdated. Escalation cycle will advance on each ticker run.',
    doseId: targetDose.id,
    medName: targetDose.medName,
    demoTimeline: {
      remindedAt: 'Immediate (due time passed)',
      escalated1At: 'In ~1 minute (Caretakers notified)',
      escalated2At: 'In ~2 minutes (Family + Caretakers notified)',
      missedAt: 'In ~3 minutes (Marked MISSED, counts towards adherence)',
    },
  });
});

/**
 * POST /demo/reset
 * Resets the demo circle to pristine seed state.
 * Only permitted on circleId "demo-circle" and only by CARETAKER when DEMO_MODE is true.
 */
demoRoutes.post('/reset', async (c) => {
  const user = c.get('user');
  if (user.circleId !== 'demo-circle') {
    throw Errors.forbidden('/demo/reset is strictly limited to circleId "demo-circle"');
  }

  await seedDemoCircle({
    elderEmail: process.env.ELDER_EMAIL,
    caretakerEmail: process.env.CARETAKER_EMAIL,
    familyEmail: process.env.FAMILY_EMAIL,
  });

  return c.json({
    success: true,
    message: 'Demo circle reset and re-seeded successfully.',
    circleId: 'demo-circle',
  });
});

/**
 * POST /demo/digest
 * Manually triggers the weekly adherence digest calculation and emails
 */
demoRoutes.post('/digest', async (c) => {
  const result = await runWeeklyDigest(new Date());
  return c.json({
    success: true,
    message: 'Weekly digest executed successfully',
    result,
  });
});

export { demoRoutes };
