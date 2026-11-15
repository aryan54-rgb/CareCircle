import { Hono } from 'hono';
import { doseRepo } from '../db/repos/doseRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { calculateAdherence } from '../domain/adherence.js';
import { requireAuth } from '../lib/middleware.js';
import { addDays, nowISO } from '../lib/time.js';

const adherenceRoutes = new Hono();

adherenceRoutes.use('*', requireAuth);

/**
 * GET /adherence?days=7
 * Compute adherence stats, daily rates, and refill warnings
 */
adherenceRoutes.get('/', async (c) => {
  const user = c.get('user');
  const days = Math.min(30, Math.max(1, Number(c.req.query('days') || 7)));

  const circle = await circleRepo.get(user.circleId);
  const timeZone = circle?.timezone || 'Asia/Kolkata';

  const now = new Date();
  const startUTC = addDays(now, -days).toISOString();
  const endUTC = now.toISOString();

  const [doses, meds] = await Promise.all([
    doseRepo.listByRange(user.circleId, startUTC, endUTC),
    medRepo.listByCircle(user.circleId),
  ]);

  const summary = calculateAdherence(doses, meds, days, timeZone);

  return c.json(summary);
});

export { adherenceRoutes };
