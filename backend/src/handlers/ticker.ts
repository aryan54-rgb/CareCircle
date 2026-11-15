import { ScheduledEvent, Context } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
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

export async function handler(event: ScheduledEvent | { task?: string }, context?: Context) {
  const now = new Date();
  const nowStr = now.toISOString();
  console.log(`[Ticker] Running at ${nowStr}. Event:`, JSON.stringify(event));

  // Check if this is the daily extend-horizon task
  if ('task' in event && event.task === 'extend-horizon') {
    return handleDailyExtendHorizon(now);
  }

  // 1. Query GSI1 for all open items due for action right now
  let itemsToProcess: any[] = [];
  try {
    let lastEvaluatedKey: any = undefined;
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
        itemsToProcess.push(...res.Items);
      }
      lastEvaluatedKey = res.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (err) {
    console.error('[Ticker] Failed to query GSI1:', err);
    return { status: 'error', error: String(err) };
  }

  console.log(`[Ticker] Found ${itemsToProcess.length} open item(s) requiring action.`);
  let processedCount = 0;
  let transitionCount = 0;

  // Process each due item
  for (const item of itemsToProcess) {
    processedCount++;
    try {
      if (typeof item.SK === 'string' && item.SK.startsWith('D#')) {
        // Dose item
        const transitioned = await processDoseItem(item as DoseItem, now);
        if (transitioned) transitionCount++;
      } else if (typeof item.SK === 'string' && item.SK.startsWith('A#')) {
        // Appointment item
        const transitioned = await processAppointmentItem(item as AppointmentItem, now);
        if (transitioned) transitionCount++;
      }
    } catch (itemErr) {
      console.error(`[Ticker] Error processing item ${item.PK} / ${item.SK}:`, itemErr);
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
async function processDoseItem(dose: DoseItem, now: Date): Promise<boolean> {
  const circleId = dose.circleId;
  const [circle, members] = await Promise.all([
    circleRepo.get(circleId),
    memberRepo.listByCircle(circleId),
  ]);

  if (!circle) {
    console.warn(`[Ticker] Circle not found for dose ${dose.id}`);
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

  console.log(
    `[Ticker] Advancing dose ${dose.id} (${dose.medName}): ${dose.status} -> ${nextStatus}`
  );

  const { dueAt, medId } = parseDoseId(dose.id);

  // Conditional Write: only update if status is still dose.status (prevents duplicates)
  try {
    let updateExpression =
      'SET #s = :nextStatus, updatedAt = :now, nextActionAt = :nextActionAt';
    const expressionAttrNames: Record<string, string> = { '#s': 'status' };
    const expressionAttrValues: Record<string, any> = {
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
  } catch (condErr: any) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      console.log(`[Ticker] Conditional check failed for dose ${dose.id} (already advanced or marked)`);
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

  // Deliver emails: Send ONE recipient at a time (SES Sandbox safeguard)
  let totalRecipientsAttempted = 0;
  let successfulSends = 0;
  const sendResults: { to: string; success: boolean; error?: string }[] = [];

  for (const intent of transition.emails) {
    const recipients = members
      .filter((m) => m.role === intent.recipientRole && m.email)
      .map((m) => m.email);

    for (const recipient of recipients) {
      totalRecipientsAttempted++;
      const res = await mailer.send({
        to: [recipient],
        subject: intent.subject,
        medName: dose.medName,
        stage: nextStatus,
        takeUrl,
        skipUrl,
      });
      sendResults.push({ to: recipient, success: res.success, error: res.error });
      if (res.success) {
        successfulSends++;
      }

      // Record in Notification Center (stores every email attempt for judges & caretakers)
      await notifRepo.create({
        circleId,
        to: recipient,
        subject: intent.subject,
        stage: nextStatus,
        success: res.success,
        error: res.error,
      });
    }
  }

  // Retry / Revert logic:
  // Revert only if ALL attempted recipients failed.
  // After 3 retries, advance anyway and record the failure so state machine never stalls.
  if (totalRecipientsAttempted > 0 && successfulSends === 0) {
    const currentRetries = (dose as any).retryCount || 0;
    if (currentRetries < 3) {
      console.error(
        `[Ticker] Every recipient send failed for dose ${dose.id} (${dose.medName}) stage ${nextStatus}. Reverting to ${dose.status} for retry next tick (${currentRetries + 1}/3). Errors:`,
        sendResults
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
      } catch (revertErr) {
        console.warn('[Ticker] Revert aborted (concurrent modification):', revertErr);
      }

      return false;
    } else {
      console.warn(
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
async function processAppointmentItem(appt: AppointmentItem, now: Date): Promise<boolean> {
  const circleId = appt.circleId;
  const [circle, members] = await Promise.all([
    circleRepo.get(circleId),
    memberRepo.listByCircle(circleId),
  ]);

  if (!circle) {
    console.warn(`[Ticker] Circle not found for appointment ${appt.id}`);
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

  console.log(
    `[Ticker] Advancing appointment ${appt.id} (${appt.doctor}): ${appt.stage} -> ${nextStage}`
  );

  const { startsAt, apptId } = parseApptId(appt.id);

  try {
    let updateExpression = 'SET stage = :nextStage, updatedAt = :now, nextActionAt = :nextActionAt';
    const exprAttrValues: Record<string, any> = {
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
  } catch (condErr: any) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw condErr;
  }

  // Deliver appointment emails (one recipient at a time)
  for (const intent of transition.emails) {
    const recipients = members
      .filter((m) => intent.recipientRoles.includes(m.role as any) && m.email)
      .map((m) => m.email);

    for (const recipient of recipients) {
      const res = await mailer.send({
        to: [recipient],
        subject: intent.subject,
        doctor: appt.doctor,
        place: appt.place,
        startsAt: appt.startsAt,
        notes: appt.notes,
        stage: nextStage,
      });

      await notifRepo.create({
        circleId,
        to: recipient,
        subject: intent.subject,
        stage: nextStage,
        success: res.success,
        error: res.error,
      });
    }
  }

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
  console.log('[Ticker] Executing daily extend-horizon task for active medications');
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

  console.log(`[Ticker] Extend-horizon complete. Created: ${createdCount}, Preserved: ${preservedCount}`);
  return {
    status: 'horizon-extended',
    createdCount,
    preservedCount,
    timestamp: now.toISOString(),
  };
}
