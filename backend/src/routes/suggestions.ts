import { Hono } from 'hono';
import { suggestionRepo } from '../db/repos/suggestionRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { doseRepo } from '../db/repos/doseRepo.js';
import { apptRepo } from '../db/repos/apptRepo.js';
import { generateDoses } from '../domain/scheduleGenerator.js';
import { activityService } from '../services/activity.js';
import { requireAuth, requirePermission } from '../lib/middleware.js';
import { createSuggestionSchema, decideSuggestionSchema } from '../lib/validate.js';
import { Errors } from '../lib/errors.js';

const suggestionsRoutes = new Hono();

suggestionsRoutes.use('*', requireAuth);

/**
 * GET /suggestions
 * List suggestions for circle
 */
suggestionsRoutes.get('/', async (c) => {
  const user = c.get('user');
  const items = await suggestionRepo.listByCircle(user.circleId);
  return c.json({ suggestions: items });
});

/**
 * POST /suggestions
 * Propose a new medication, change, or appointment (Family, Caretaker, Elder)
 */
suggestionsRoutes.post('/', requirePermission('SUBMIT_SUGGESTION'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = createSuggestionSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const member = await memberRepo.get(user.circleId, user.memberId);
  const actorName = member?.name || user.role;

  const item = await suggestionRepo.create({
    circleId: user.circleId,
    type: parsed.data.type,
    title: parsed.data.title,
    payload: parsed.data.payload,
    proposedBy: user.memberId,
    proposedByName: actorName,
    proposedByRole: user.role,
  });

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'SUBMIT_SUGGESTION',
    summary: `${actorName} (${user.role}) suggested: "${item.title}". Waiting for approval.`,
  });

  return c.json({
    suggestion: item,
    message: 'Suggestion submitted for elder/caretaker approval.',
  });
});

/**
 * POST /suggestions/:id/approve
 * Elder (primary) or Caretaker approves the suggestion
 */
suggestionsRoutes.post('/:id/approve', requirePermission('DECIDE_SUGGESTION'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = decideSuggestionSchema.safeParse(body);

  const found = await suggestionRepo.get(user.circleId, id);
  if (!found) throw Errors.notFound('Suggestion not found');
  const { item, SK } = found;

  if (item.status !== 'PENDING') {
    throw Errors.badRequest(`Suggestion already decided (${item.status})`);
  }

  const [member, circle] = await Promise.all([
    memberRepo.get(user.circleId, user.memberId),
    circleRepo.get(user.circleId),
  ]);
  const actorName = member?.name || user.role;

  // Execute the suggested action
  if (item.type === 'NEW_MED') {
    const p = item.payload;
    const medId = Math.random().toString(36).substring(2, 10);
    const med = await medRepo.create({
      medId,
      circleId: user.circleId,
      name: p.name || item.title,
      strength: p.strength || '1 tablet',
      form: p.form || 'tablet',
      instructions: p.instructions || '',
      times: p.times || ['09:00'],
      daysOfWeek: p.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      startDate: p.startDate || new Date().toISOString().split('T')[0],
      active: true,
      pillCount: p.pillCount,
    });

    // Materialise 7 days of doses
    const preMinutes = circle?.settings?.demoMode ? 0 : circle?.settings?.preMinutes ?? 10;
    const doses = generateDoses(
      {
        medId: med.medId,
        name: med.name,
        times: med.times,
        daysOfWeek: med.daysOfWeek,
        startDate: med.startDate,
      },
      user.circleId,
      circle?.timezone || 'Asia/Kolkata',
      preMinutes,
      7
    );
    await doseRepo.batchCreate(doses);
  } else if (item.type === 'APPOINTMENT') {
    const p = item.payload;
    await apptRepo.create({
      circleId: user.circleId,
      doctor: p.doctor || 'Doctor',
      place: p.place || 'Clinic',
      notes: p.notes,
      startsAt: p.startsAt || new Date().toISOString(),
    });
  }

  // Update status in DynamoDB
  await suggestionRepo.updateStatus(
    user.circleId,
    SK,
    'APPROVED',
    user.memberId,
    actorName,
    parsed.success ? parsed.data.decisionNote : undefined
  );

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'APPROVE_SUGGESTION',
    summary: `${actorName} approved suggestion: "${item.title}". Added to schedule.`,
  });

  return c.json({
    success: true,
    message: `Suggestion "${item.title}" approved and applied!`,
  });
});

/**
 * POST /suggestions/:id/decline
 * Elder or Caretaker declines the suggestion
 */
suggestionsRoutes.post('/:id/decline', requirePermission('DECIDE_SUGGESTION'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = decideSuggestionSchema.safeParse(body);

  const found = await suggestionRepo.get(user.circleId, id);
  if (!found) throw Errors.notFound('Suggestion not found');
  const { item, SK } = found;

  if (item.status !== 'PENDING') {
    throw Errors.badRequest(`Suggestion already decided (${item.status})`);
  }

  const member = await memberRepo.get(user.circleId, user.memberId);
  const actorName = member?.name || user.role;

  await suggestionRepo.updateStatus(
    user.circleId,
    SK,
    'DECLINED',
    user.memberId,
    actorName,
    parsed.success ? parsed.data.decisionNote : undefined
  );

  await activityService.log({
    circleId: user.circleId,
    actorId: user.memberId,
    actorName,
    action: 'DECLINE_SUGGESTION',
    summary: `${actorName} declined suggestion: "${item.title}".`,
  });

  return c.json({
    success: true,
    message: `Suggestion "${item.title}" declined.`,
  });
});

export { suggestionsRoutes };
