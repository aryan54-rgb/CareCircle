import { Hono } from 'hono';
import { circleRepo, DEMO_CIRCLE_SETTINGS } from '../db/repos/circleRepo.js';
import { doseRepo, parseDoseId } from '../db/repos/doseRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { requireAuth } from '../lib/middleware.js';
import { addMinutes, nowISO } from '../lib/time.js';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Errors } from '../lib/errors.js';

const demoRoutes = new Hono();

demoRoutes.use('*', requireAuth);

/**
 * POST /demo/trigger-missed
 * Helper for live hackathon demo: forces an open dose into due state under demo timing
 * (pre=0, e1=1min, e2=2min, missed=3min) so escalations happen in real-time
 */
demoRoutes.post('/trigger-missed', async (c) => {
  if (!config.isDemoMode) {
    throw Errors.forbidden('Demo mode is disabled');
  }

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
  const pastDue = addMinutes(now, -1).toISOString(); // 1 minute in past
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

export { demoRoutes };
