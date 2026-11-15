import { Hono } from 'hono';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { authRepo } from '../db/repos/authRepo.js';
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
  if (!member) {
    throw Errors.notFound('Member profile not found');
  }

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
 * Return circle metadata, member list, and active settings
 */
circleRoutes.get('/circle', async (c) => {
  const user = c.get('user');
  const [circle, members] = await Promise.all([
    circleRepo.get(user.circleId),
    memberRepo.listByCircle(user.circleId),
  ]);

  if (!circle) {
    throw Errors.notFound('Circle not found');
  }

  return c.json({
    circle,
    members,
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
    summary: 'Updated circle reminder and escalation settings.',
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

  // Generate clean 6-character code (avoid confusing chars like 0, O, 1, I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
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

export { circleRoutes };
