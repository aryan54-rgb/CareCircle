import { Hono } from 'hono';
import { apptRepo } from '../db/repos/apptRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { activityService } from '../services/activity.js';
import { requireAuth, requirePermission } from '../lib/middleware.js';
import { createAppointmentSchema, updateAppointmentSchema } from '../lib/validate.js';
import { Errors } from '../lib/errors.js';

const appointmentsRoutes = new Hono();

appointmentsRoutes.use('*', requireAuth);

/**
 * GET /appointments
 * List appointments for the circle
 */
appointmentsRoutes.get('/', async (c) => {
  const user = c.get('user');
  const appts = await apptRepo.listByCircle(user.circleId);
  return c.json({
    appointments: appts.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  });
});

/**
 * GET /appointments/:id
 * Get single appointment
 */
appointmentsRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const appt = await apptRepo.get(user.circleId, c.req.param('id'));
  if (!appt) throw Errors.notFound('Appointment not found');
  return c.json({ appointment: appt });
});

/**
 * POST /appointments
 * Schedule a new appointment (Elder & Caretaker)
 */
appointmentsRoutes.post('/', requirePermission('MANAGE_APPOINTMENTS'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const member = await memberRepo.get(user.circleId, user.memberId);
  const actorName = member?.name || user.role;

  const appt = await apptRepo.create({
    circleId: user.circleId,
    ...parsed.data,
  });

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'CREATE_APPOINTMENT',
    summary: `${actorName} scheduled an appointment with Dr. ${appt.doctor} at ${appt.place}.`,
  });

  return c.json({
    appointment: appt,
    message: 'Appointment scheduled successfully',
  });
});

/**
 * PATCH /appointments/:id
 * Update appointment details (Elder & Caretaker)
 */
appointmentsRoutes.patch('/:id', requirePermission('MANAGE_APPOINTMENTS'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const member = await memberRepo.get(user.circleId, user.memberId);
  const actorName = member?.name || user.role;

  const updated = await apptRepo.update(user.circleId, id, parsed.data);
  if (!updated) throw Errors.notFound('Appointment not found');

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'UPDATE_APPOINTMENT',
    summary: `${actorName} updated appointment with Dr. ${updated.doctor}.`,
  });

  return c.json({ appointment: updated });
});

/**
 * DELETE /appointments/:id
 * Delete appointment (Elder & Caretaker)
 */
appointmentsRoutes.delete('/:id', requirePermission('MANAGE_APPOINTMENTS'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const [existing, member] = await Promise.all([
    apptRepo.get(user.circleId, id),
    memberRepo.get(user.circleId, user.memberId),
  ]);
  if (!existing) throw Errors.notFound('Appointment not found');

  const actorName = member?.name || user.role;
  await apptRepo.delete(user.circleId, id);

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'DELETE_APPOINTMENT',
    summary: `${actorName} cancelled appointment with Dr. ${existing.doctor}.`,
  });

  return c.json({ success: true, message: 'Appointment cancelled' });
});

export { appointmentsRoutes };
