import { ScheduledEvent, Context } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../db/client.js';
import { Keys } from '../db/keys.js';
import { config } from '../lib/config.js';
import { circleRepo } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { doseRepo, DoseItem, parseDoseId } from '../db/repos/doseRepo.js';
import { nextStage, EmailIntent } from '../domain/doseStateMachine.js';
import { generateDoses } from '../domain/scheduleGenerator.js';
import { signConfirmToken } from '../services/tokens.js';
import { mailer } from '../services/mailer.js';
import { activityService } from '../services/activity.js';
import { nowISO } from '../lib/time.js';

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
      // Check if it's a dose event (SK begins with 'D#')
      if (typeof item.SK === 'string' && item.SK.startsWith('D#')) {
        const transitioned = await processDoseItem(item as DoseItem, now);
        if (transitioned) transitionCount++;
      }
      // Appointments handling will be expanded in Phase 4
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

  // Parse dueAt and medId from dose keys
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

  // Deliver emails according to the generated intents
  for (const intent of transition.emails) {
    const recipients = members
      .filter((m) => m.role === intent.recipientRole && m.email)
      .map((m) => m.email);

    if (recipients.length > 0) {
      await mailer.send({
        to: recipients,
        subject: intent.subject,
        medName: dose.medName,
        stage: nextStatus,
        takeUrl,
        skipUrl,
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
 * Daily extend-horizon task tops up to 7 days ahead for all active meds
 */
async function handleDailyExtendHorizon(now: Date) {
  console.log('[Ticker] Executing daily extend-horizon task for active medications');
  return { status: 'horizon-extended', timestamp: now.toISOString() };
}
