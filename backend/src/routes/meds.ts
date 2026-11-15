import { Hono } from 'hono';
import { medRepo } from '../db/repos/medRepo.js';
import { doseRepo } from '../db/repos/doseRepo.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { activityService } from '../services/activity.js';
import { requireAuth, requirePermission } from '../lib/middleware.js';
import { createMedicationSchema, updateMedicationSchema } from '../lib/validate.js';
import { generateDoses } from '../domain/scheduleGenerator.js';
import { Errors } from '../lib/errors.js';
import { nowISO } from '../lib/time.js';

const medsRoutes = new Hono();

medsRoutes.use('*', requireAuth);

/**
 * GET /meds
 * List all medications for the circle (all roles can view)
 */
medsRoutes.get('/', async (c) => {
  const user = c.get('user');
  const activeOnly = c.req.query('activeOnly') === 'true';
  const meds = await medRepo.listByCircle(user.circleId, activeOnly);
  return c.json({ medications: meds });
});

/**
 * GET /meds/:id
 * Get details of a single medication
 */
medsRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const med = await medRepo.get(user.circleId, c.req.param('id'));
  if (!med) {
    throw Errors.notFound('Medication not found');
  }
  return c.json({ medication: med });
});

/**
 * POST /meds
 * Create a new medication and materialise 7 days of doses (Elder & Caretaker)
 */
medsRoutes.post('/', requirePermission('MANAGE_MEDS'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createMedicationSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const [circle, member] = await Promise.all([
    circleRepo.get(user.circleId),
    memberRepo.get(user.circleId, user.memberId),
  ]);

  if (!circle) throw Errors.notFound('Circle not found');
  const actorName = member?.name || user.role;

  const medId = Math.random().toString(36).substring(2, 10);
  const med = await medRepo.create({
    medId,
    circleId: user.circleId,
    ...parsed.data,
    active: true,
  });

  // Materialise doses for next 7 days in circle's timezone
  const preMinutes = circle.settings?.demoMode ? 0 : circle.settings?.preMinutes ?? 10;
  const doses = generateDoses(
    {
      medId: med.medId,
      name: med.name,
      times: med.times,
      daysOfWeek: med.daysOfWeek,
      startDate: med.startDate,
      endDate: med.endDate,
    },
    user.circleId,
    circle.timezone,
    preMinutes,
    7
  );

  await doseRepo.batchCreate(doses);

  // Log activity
  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'ADD_MEDICATION',
    summary: `${actorName} added medication ${med.name} (${med.strength}) with ${doses.length} scheduled doses.`,
  });

  return c.json({
    medication: med,
    dosesGenerated: doses.length,
  });
});

/**
 * PATCH /meds/:id
 * Update medication and regenerate future SCHEDULED doses (Elder & Caretaker)
 */
medsRoutes.patch('/:id', requirePermission('MANAGE_MEDS'), async (c) => {
  const user = c.get('user');
  const medId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateMedicationSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const [circle, member] = await Promise.all([
    circleRepo.get(user.circleId),
    memberRepo.get(user.circleId, user.memberId),
  ]);

  if (!circle) throw Errors.notFound('Circle not found');
  const actorName = member?.name || user.role;

  const updatedMed = await medRepo.update(user.circleId, medId, parsed.data);
  if (!updatedMed) {
    throw Errors.notFound('Medication not found');
  }

  // Delete future scheduled doses from now
  const now = nowISO();
  await doseRepo.deleteFutureScheduled(user.circleId, medId, now);

  // Regenerate if still active
  let newDosesCount = 0;
  if (updatedMed.active) {
    const preMinutes = circle.settings?.demoMode ? 0 : circle.settings?.preMinutes ?? 10;
    const doses = generateDoses(
      {
        medId: updatedMed.medId,
        name: updatedMed.name,
        times: updatedMed.times,
        daysOfWeek: updatedMed.daysOfWeek,
        startDate: updatedMed.startDate,
        endDate: updatedMed.endDate,
      },
      user.circleId,
      circle.timezone,
      preMinutes,
      7
    );
    await doseRepo.batchCreate(doses);
    newDosesCount = doses.length;
  }

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'UPDATE_MEDICATION',
    summary: `${actorName} updated medication ${updatedMed.name}.`,
  });

  return c.json({
    medication: updatedMed,
    dosesRegenerated: newDosesCount,
  });
});

/**
 * DELETE /meds/:id
 * Deactivate medication (soft delete) and remove future scheduled doses
 */
medsRoutes.delete('/:id', requirePermission('MANAGE_MEDS'), async (c) => {
  const user = c.get('user');
  const medId = c.req.param('id');

  const [circle, member, existingMed] = await Promise.all([
    circleRepo.get(user.circleId),
    memberRepo.get(user.circleId, user.memberId),
    medRepo.get(user.circleId, medId),
  ]);

  if (!existingMed) throw Errors.notFound('Medication not found');
  const actorName = member?.name || user.role;

  // Deactivate
  await medRepo.update(user.circleId, medId, { active: false });

  // Delete future scheduled doses
  const now = nowISO();
  const deletedCount = await doseRepo.deleteFutureScheduled(user.circleId, medId, now);

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'DEACTIVATE_MEDICATION',
    summary: `${actorName} deactivated medication ${existingMed.name}. Removed ${deletedCount} future doses.`,
  });

  return c.json({
    success: true,
    message: `Medication ${existingMed.name} deactivated`,
    deletedFutureDoses: deletedCount,
  });
});

export { medsRoutes };
