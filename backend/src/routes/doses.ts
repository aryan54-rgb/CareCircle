import { Hono } from 'hono';
import { doseRepo, parseDoseId } from '../db/repos/doseRepo.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { activityService } from '../services/activity.js';
import { requireAuth, requirePermission } from '../lib/middleware.js';
import { timeStringToUTC, formatDateInTimezone, addDays } from '../lib/time.js';
import { Errors } from '../lib/errors.js';

const dosesRoutes = new Hono();

dosesRoutes.use('*', requireAuth);


/**
 * GET /doses?date=YYYY-MM-DD
 * Get doses for a specified date in the circle's timezone (defaults to today)
 */
dosesRoutes.get('/', async (c) => {
  const user = c.get('user');
  const circle = await circleRepo.get(user.circleId);
  if (!circle) throw Errors.notFound('Circle not found');

  const timezone = circle.timezone || 'Asia/Kolkata';
  const queryDate = c.req.query('date') || formatDateInTimezone(new Date(), timezone);

  // Convert the start and end of that local calendar day to UTC bounds
  const startUTC = timeStringToUTC(queryDate, '00:00', timezone);
  const nextDay = formatDateInTimezone(addDays(new Date(queryDate + 'T12:00:00Z'), 1), timezone);
  const endUTC = timeStringToUTC(nextDay, '00:00', timezone);

  const doses = await doseRepo.listByRange(user.circleId, startUTC, endUTC);

  // Identify next dose (hero dose for Today view)
  const now = new Date().toISOString();
  const nextDose =
    doses.find((d) => d.status === 'SCHEDULED' || d.status === 'REMINDED') ||
    doses.find((d) => d.status.startsWith('ESCALATED')) ||
    null;

  return c.json({
    date: queryDate,
    timezone,
    heroDose: nextDose,
    doses,
  });
});

/**
 * POST /doses/:id/take
 * Mark dose as taken (Elder or Caretaker on behalf)
 */
dosesRoutes.post('/:id/take', requirePermission('MARK_DOSE'), async (c) => {
  const user = c.get('user');
  const { dueAt, medId } = parseDoseId(c.req.param('id'));

  const [existingDose, member] = await Promise.all([
    doseRepo.get(user.circleId, `${dueAt}#${medId}`),
    memberRepo.get(user.circleId, user.memberId),
  ]);

  if (!existingDose) {
    throw Errors.notFound('Dose event not found');
  }

  if (existingDose.status === 'TAKEN') {
    return c.json({ dose: existingDose, message: 'Dose already marked as taken' });
  }

  const actorName = member?.name || user.role;
  const updatedDose = await doseRepo.markTaken(
    user.circleId,
    dueAt,
    medId,
    user.memberId,
    actorName
  );

  // Decrement pill count if tracked
  await medRepo.decrementPillCount(user.circleId, medId);

  // Log activity
  const isCaretaker = user.role === 'CARETAKER';
  const summary = isCaretaker
    ? `${actorName} marked dose of ${existingDose.medName} as taken on behalf of elder.`
    : `${actorName} marked dose of ${existingDose.medName} as taken.`;

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'DOSE_TAKEN',
    summary,
  });

  return c.json({
    dose: updatedDose,
    message: 'Dose recorded successfully as taken',
  });
});

/**
 * POST /doses/:id/skip
 * Mark dose as skipped (Elder or Caretaker)
 */
dosesRoutes.post('/:id/skip', requirePermission('MARK_DOSE'), async (c) => {
  const user = c.get('user');
  const { dueAt, medId } = parseDoseId(c.req.param('id'));

  const [existingDose, member] = await Promise.all([
    doseRepo.get(user.circleId, `${dueAt}#${medId}`),
    memberRepo.get(user.circleId, user.memberId),
  ]);

  if (!existingDose) {
    throw Errors.notFound('Dose event not found');
  }

  const actorName = member?.name || user.role;
  const updatedDose = await doseRepo.markSkipped(
    user.circleId,
    dueAt,
    medId,
    user.memberId,
    actorName
  );

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'DOSE_SKIPPED',
    summary: `${actorName} skipped dose of ${existingDose.medName}.`,
  });

  return c.json({
    dose: updatedDose,
    message: 'Dose recorded as skipped',
  });
});

export { dosesRoutes };
