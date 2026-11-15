import { ScheduledEvent, Context } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo, Member } from '../db/repos/memberRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { doseRepo, DoseItem, parseDoseId } from '../db/repos/doseRepo.js';
import { apptRepo, AppointmentItem, parseApptId } from '../db/repos/apptRepo.js';
import { notifRepo } from '../db/repos/notifRepo.js';
import { nextStage } from '../domain/doseStateMachine.js';
import { nextAppointmentStage } from '../domain/appointmentStateMachine.js';
import { generateDoses } from '../domain/scheduleGenerator.js';
import { signConfirmToken } from '../services/tokens.js';
import { mailer } from '../services/mailer.js';
import { activityService } from '../services/activity.js';
import { Role } from '../lib/validate.js';
import { logger } from '../lib/logger.js';

export interface DeliveryIntent {
  recipientRoles: Role[];
  subject: string;
}

export interface DeliveryContext {
  circleId: string;
  stage: string;
  members: Omit<Member, 'passcodeHash'>[];
  medName?: string;
  takeUrl?: string;
  skipUrl?: string;
  doctor?: string;
  place?: string;
  startsAt?: string;
  notes?: string;
}

export interface DeliveryResult {
  totalAttempted: number;
  successfulSends: number;
  results: { to: string; success: boolean; error?: string }[];
}

/**
 * Common delivery helper for both dose escalation and appointment notification flows.
 * Delivers emails one recipient at a time (SES Sandbox safe) and logs each to Notification Center.
 */
export async function deliver(
  intents: DeliveryIntent[],
  ctx: DeliveryContext
): Promise<DeliveryResult> {
  let totalAttempted = 0;
  let successfulSends = 0;
  const results: { to: string; success: boolean; error?: string }[] = [];

  for (const intent of intents) {
    const roles = new Set(intent.recipientRoles);
    const recipients = ctx.members
      .filter((m) => roles.has(m.role) && m.email)
      .map((m) => m.email);

    for (const recipient of recipients) {
      totalAttempted++;
      const res = await mailer.send({
        to: [recipient],
        subject: intent.subject,
        stage: ctx.stage,
        medName: ctx.medName,
        takeUrl: ctx.takeUrl,
        skipUrl: ctx.skipUrl,
        doctor: ctx.doctor,
        place: ctx.place,
        startsAt: ctx.startsAt,
        notes: ctx.notes,
      });

      results.push({ to: recipient, success: res.success, error: res.error });
      if (res.success) {
        successfulSends++;
      }

      await notifRepo.create({
        circleId: ctx.circleId,
        to: recipient,
        subject: intent.subject,
        stage: ctx.stage,
        success: res.success,
        error: res.error,
      });
    }
  }

  return { totalAttempted, successfulSends, results };
}

export async function handler(event: ScheduledEvent | { task?: string }, context?: Context) {
  const now = new Date();
  const nowStr = now.toISOString();
  logger.info(`[Ticker] Running at ${nowStr}. Event: ${JSON.stringify(event)}`);

  // Check if this is the daily extend-horizon task
  if ('task' in event && event.task === 'extend-horizon') {
    return handleDailyExtendHorizon(now);
  }

  // 1. Query GSI1 for all open items due for action right now
  const itemsToProcess: Record<string, unknown>[] = [];
  try {
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
    do {
      const res = await docClient.send(
        new QueryCommand({
          TableName: config.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :open AND GSI1SK <= :now',
          ExpressionAttributeValues: {
            ':open': 'OPEN',
            ':now': nowStr,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      if (res.Items) {
        itemsToProcess.push(...(res.Items as Record<string, unknown>[]));
      }
      lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Ticker] Failed to query GSI1: ${msg}`);
    return { status: 'error', error: msg };
  }

  logger.info(`[Ticker] Found ${itemsToProcess.length} open item(s) requiring action.`);
  let processedCount = 0;
  let transitionCount = 0;

  // Process each due item
  for (const item of itemsToProcess) {
    processedCount++;
    try {
      if (typeof item.SK === 'string' && item.SK.startsWith('D#')) {
        // Dose item
        const transitioned = await processDoseItem(item as unknown as DoseItem, now);
        if (transitioned) transitionCount++;
      } else if (typeof item.SK === 'string' && item.SK.startsWith('A#')) {
        // Appointment item
        const transitioned = await processAppointmentItem(item as unknown as AppointmentItem, now);
        if (transitioned) transitionCount++;
      }
    } catch (itemErr: unknown) {
      logger.error(`[Ticker] Error processing item ${String(item.PK)} / ${String(item.SK)}:`, itemErr);
    }
  }

  return {
    status: 'ok',
    timestamp: nowStr,
    found: itemsToProcess.length,
    processed: processedCount,
    transitions: transitionCount,
  };
}

/**
 * Processes an individual dose item through the pure doseStateMachine
 */
export async function processDoseItem(dose: DoseItem, now: Date): Promise<boolean> {
  const circleId = dose.circleId;
  const [circle, members] = await Promise.all([
    circleRepo.get(circleId),
    memberRepo.listByCircle(circleId),
  ]);

  if (!circle) {
    logger.warn(`[Ticker] Circle not found for dose ${dose.id}`);
    return false;
  }

  const settings = circle.settings;
  const transition = nextStage(dose, settings, now);

  if (!transition.nextStatus) {
    // No transition needed yet
    return false;
  }

  const nextStatus = transition.nextStatus;
  const nextActionAt = transition.nextActionAt;
  const isTerminal = transition.isTerminal;

  logger.info(
    `[Ticker] Advancing dose ${dose.id} (${dose.medName}): ${dose.status} -> ${nextStatus}`
  );

  const { dueAt, medId } = parseDoseId(dose.id);

  // Conditional Write: only update if status is still dose.status (prevents duplicates)
  try {
    let updateExpression =
      'SET #s = :nextStatus, updatedAt = :now, nextActionAt = :nextActionAt';
    const expressionAttrNames: Record<string, string> = { '#s': 'status' };
    const expressionAttrValues: Record<string, string | number> = {
      ':nextStatus': nextStatus,
      ':expectedStatus': dose.status,
      ':nextActionAt': nextActionAt || '',
      ':now': now.toISOString(),
    };

    if (isTerminal) {
      updateExpression += ' REMOVE GSI1PK, GSI1SK';
    } else {
      updateExpression += ', GSI1SK = :nextActionAt';
    }

    await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.dose(circleId, dueAt, medId),
        UpdateExpression: updateExpression,
        ConditionExpression: '#s = :expectedStatus',
        ExpressionAttributeNames: expressionAttrNames,
        ExpressionAttributeValues: expressionAttrValues,
      })
    );
  } catch (condErr: unknown) {
    if (
      typeof condErr === 'object' &&
      condErr !== null &&
      'name' in condErr &&
      (condErr as { name: string }).name === 'ConditionalCheckFailedException'
    ) {
      logger.info(`[Ticker] Conditional check failed for dose ${dose.id} (already advanced or marked)`);
      return false;
    }
    throw condErr;
  }

  // Generate one-tap action URLs for reminder emails
  let takeUrl: string | undefined = undefined;
  let skipUrl: string | undefined = undefined;

  if (nextStatus === 'REMINDED') {
    const takeToken = await signConfirmToken({
      doseId: dose.id,
      circleId,
      action: 'take',
    });
    const skipToken = await signConfirmToken({
      doseId: dose.id,
      circleId,
      action: 'skip',
    });
    const baseUrl = config.apiUrl || config.appUrl;
    takeUrl = `${baseUrl}/p/confirm?t=${takeToken}`;
    skipUrl = `${baseUrl}/p/confirm?t=${skipToken}`;
  }

  // Deliver emails via extracted common deliver() helper
  const intents: DeliveryIntent[] = transition.emails.map((intent) => ({
    recipientRoles: [intent.recipientRole as Role],
    subject: intent.subject,
  }));

  const { totalAttempted: totalRecipientsAttempted, successfulSends, results: sendResults } =
    await deliver(intents, {
      circleId,
      stage: nextStatus,
      members,
      medName: dose.medName,
      takeUrl,
      skipUrl,
    });

  // Retry / Revert logic:
  // Revert only if ALL attempted recipients failed.
  // After 3 retries, advance anyway and record the failure so state machine never stalls.
  if (totalRecipientsAttempted > 0 && successfulSends === 0) {
    const currentRetries = dose.retryCount || 0;
    if (currentRetries < 3) {
      logger.error(
        `[Ticker] Every recipient send failed for dose ${dose.id} (${dose.medName}) stage ${nextStatus}. Reverting to ${dose.status} for retry next tick (${currentRetries + 1}/3). Errors: ${JSON.stringify(sendResults)}`
      );

      try {
        await docClient.send(
          new UpdateCommand({
            TableName: config.tableName,
            Key: Keys.dose(circleId, dueAt, medId),
            UpdateExpression:
              'SET #s = :prevStatus, retryCount = :retryCount, GSI1PK = :open, GSI1SK = :retryAt, updatedAt = :now',
            ConditionExpression: '#s = :nextStatus',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':prevStatus': dose.status,
              ':nextStatus': nextStatus,
              ':retryCount': currentRetries + 1,
              ':open': 'OPEN',
              ':retryAt': new Date(now.getTime() + 60000).toISOString(),
              ':now': now.toISOString(),
            },
          })
        );
      } catch (revertErr: unknown) {
        logger.warn('[Ticker] Revert aborted (concurrent modification):', revertErr);
      }

      return false;
    } else {
      logger.warn(
        `[Ticker] Retry cap (3) reached for dose ${dose.id} (${dose.medName}). Advancing anyway to prevent stall.`
      );
      await activityService.log({
        circleId,
        actorId: 'system-ticker',
        actorName: 'System Ticker',
        action: 'EMAIL_DELIVERY_FAILED',
        summary: `Email delivery failed for ${nextStatus} notice of ${dose.medName} after 3 retries. Errors: ${sendResults.map((r) => `${r.to}: ${r.error || 'unverified'}`).join('; ')}`,
      });
    }
  }

  // Log activity
  await activityService.log({
    circleId,
    actorId: 'system-ticker',
    actorName: 'System Ticker',
    action: `DOSE_${nextStatus}`,
    summary: `Dose of ${dose.medName} advanced to ${nextStatus}.`,
  });

  return true;
}

/**
 * Processes an individual appointment item through the pure appointmentStateMachine
 */
export async function processAppointmentItem(appt: AppointmentItem, now: Date): Promise<boolean> {
  const circleId = appt.circleId;
  const [circle, members] = await Promise.all([
    circleRepo.get(circleId),
    memberRepo.listByCircle(circleId),
  ]);

  if (!circle) {
    logger.warn(`[Ticker] Circle not found for appointment ${appt.id}`);
    return false;
  }

  const transition = nextAppointmentStage(
    appt,
    circle.settings || { appointmentReminders: [1440, 120] },
    now
  );

  if (!transition.nextStage) {
    return false;
  }

  const nextStage = transition.nextStage;
  const isTerminal = transition.isTerminal;
  const nextActionAt = transition.nextActionAt;

  logger.info(
    `[Ticker] Advancing appointment ${appt.id} (${appt.doctor}): ${appt.stage} -> ${nextStage}`
  );

  const { startsAt, apptId } = parseApptId(appt.id);

  try {
    let updateExpression = 'SET stage = :nextStage, updatedAt = :now, nextActionAt = :nextActionAt';
    const exprAttrValues: Record<string, string | number> = {
      ':nextStage': nextStage,
      ':expectedStage': appt.stage,
      ':nextActionAt': nextActionAt || '',
      ':now': now.toISOString(),
    };

    if (isTerminal) {
      updateExpression += ' REMOVE GSI1PK, GSI1SK';
    } else {
      updateExpression += ', GSI1SK = :nextActionAt';
    }

    await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: Keys.appointment(circleId, startsAt, apptId),
        UpdateExpression: updateExpression,
        ConditionExpression: 'stage = :expectedStage',
        ExpressionAttributeValues: exprAttrValues,
      })
    );
  } catch (condErr: unknown) {
    if (
      typeof condErr === 'object' &&
      condErr !== null &&
      'name' in condErr &&
      (condErr as { name: string }).name === 'ConditionalCheckFailedException'
    ) {
      return false;
    }
    throw condErr;
  }

  // Deliver appointment emails via extracted deliver() helper
  const intents: DeliveryIntent[] = transition.emails.map((intent) => ({
    recipientRoles: intent.recipientRoles as Role[],
    subject: intent.subject,
  }));

  await deliver(intents, {
    circleId,
    stage: nextStage,
    members,
    doctor: appt.doctor,
    place: appt.place,
    startsAt: appt.startsAt,
    notes: appt.notes,
  });

  await activityService.log({
    circleId,
    actorId: 'system-ticker',
    actorName: 'System Ticker',
    action: `APPOINTMENT_${nextStage}`,
    summary: `Appointment with Dr. ${appt.doctor} updated to ${nextStage}.`,
  });

  return true;
}

/**
 * Daily extend-horizon task tops up to 7 days ahead for all active meds
 * Uses conditional puts (attribute_not_exists(PK)) so it never overwrites existing or marked doses
 */
export async function handleDailyExtendHorizon(now: Date) {
  logger.info('[Ticker] Executing daily extend-horizon task for active medications');
  const circles = await circleRepo.listAll();
  let createdCount = 0;
  let preservedCount = 0;

  for (const circle of circles) {
    const activeMeds = await medRepo.listByCircle(circle.circleId, true);
    for (const med of activeMeds) {
      const generatedDoses = generateDoses(
        med,
        circle.circleId,
        circle.timezone || 'Asia/Kolkata',
        circle.settings?.preMinutes ?? 10,
        7,
        now
      );

      for (const dose of generatedDoses) {
        const inserted = await doseRepo.putIfMissing(dose);
        if (inserted) {
          createdCount++;
        } else {
          preservedCount++;
        }
      }
    }
  }

  logger.info(`[Ticker] Extend-horizon complete. Created: ${createdCount}, Preserved: ${preservedCount}`);
  return {
    status: 'horizon-extended',
    createdCount,
    preservedCount,
    timestamp: now.toISOString(),
  };
}
