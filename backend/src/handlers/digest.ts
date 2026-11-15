import { ScheduledEvent, Context } from 'aws-lambda';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { doseRepo } from '../db/repos/doseRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { notifRepo } from '../db/repos/notifRepo.js';
import { calculateAdherence } from '../domain/adherence.js';
import { aiService } from '../services/ai.js';
import { mailer } from '../services/mailer.js';
import { activityService } from '../services/activity.js';
import { addDays, nowISO } from '../lib/time.js';

/**
 * Weekly adherence digest execution (runs per circle, computes adherence, generates AI summary, emails caretakers & family)
 */
export async function runWeeklyDigest(now: Date = new Date()) {
  const circles = await circleRepo.listAll();
  const startUTC = addDays(now, -7).toISOString();
  const endUTC = now.toISOString();

  let processedCircles = 0;
  let sentEmails = 0;

  for (const circle of circles) {
    try {
      processedCircles++;
      const [doses, members, meds] = await Promise.all([
        doseRepo.listByRange(circle.circleId, startUTC, endUTC),
        memberRepo.listByCircle(circle.circleId),
        medRepo.listByCircle(circle.circleId),
      ]);

      const adherence = calculateAdherence(doses, meds, 7, circle.timezone || 'Asia/Kolkata');

      const wording = await aiService.generateWeeklyWording({
        elderName: circle.elderName,
        overallRate: adherence.overallRate,
        takenCount: adherence.takenCount,
        missedCount: adherence.missedCount,
      });

      const recipients = members
        .filter((m) => (m.role === 'CARETAKER' || m.role === 'FAMILY') && m.email)
        .map((m) => m.email);

      for (const recipient of recipients) {
        const res = await mailer.send({
          to: [recipient],
          subject: `CareCircle Weekly Digest: ${circle.elderName} (${adherence.overallRate}% Adherence)`,
          stage: 'DIGEST',
          digestElderName: circle.elderName,
          digestSummary: wording,
          digestAdherenceRate: adherence.overallRate,
          digestStats: {
            taken: adherence.takenCount,
            skipped: adherence.skippedCount,
            missed: adherence.missedCount,
          },
        });
        sentEmails++;

        await notifRepo.create({
          circleId: circle.circleId,
          to: recipient,
          subject: `CareCircle Weekly Digest: ${circle.elderName}`,
          stage: 'DIGEST',
          success: res.success,
          error: res.error,
        });
      }

      await activityService.log({
        circleId: circle.circleId,
        actorId: 'system-digest',
        actorName: 'Weekly Digest',
        action: 'WEEKLY_DIGEST_SENT',
        summary: `Weekly adherence digest delivered to ${recipients.length} circle members. Overall score: ${adherence.overallRate}%.`,
      });
    } catch (circleErr) {
      console.error(`[Digest] Error processing circle ${circle.circleId}:`, circleErr);
    }
  }

  return {
    status: 'ok',
    processedCircles,
    sentEmails,
    timestamp: nowISO(),
  };
}

export async function handler(event: ScheduledEvent, context?: Context) {
  console.log('[Digest] Weekly adherence digest job started:', JSON.stringify(event));
  const res = await runWeeklyDigest(new Date());
  return res;
}
