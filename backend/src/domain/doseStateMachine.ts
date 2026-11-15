import { CircleSettings } from '../db/repos/circleRepo.js';
import { DoseItem, DoseStatus } from '../db/repos/doseRepo.js';
import { addMinutes } from '../lib/time.js';

export interface EmailIntent {
  recipientRole: 'ELDER' | 'CARETAKER' | 'FAMILY';
  recipientEmail?: string;
  subject: string;
  doseId: string;
  medName: string;
  dueAt: string;
  stage: DoseStatus;
}

export interface StateTransitionResult {
  nextStatus?: DoseStatus;
  nextActionAt?: string;
  emails: EmailIntent[];
  isTerminal: boolean;
}

/**
 * PURE FUNCTION: Calculates the next state transition for a dose based on elapsed time
 * Implements the CareCircle Dose Lifecycle State Machine (Section 6.1 of SPEC.md)
 */
export function nextStage(
  dose: DoseItem,
  settings: CircleSettings,
  now: Date = new Date()
): StateTransitionResult {
  const dueTime = new Date(dose.dueAt);
  const nowMs = now.getTime();

  // If already terminal, no further transitions
  if (dose.status === 'TAKEN' || dose.status === 'SKIPPED' || dose.status === 'MISSED') {
    return { emails: [], isTerminal: true };
  }

  const preMs = settings.preMinutes * 60 * 1000;
  const e1Ms = settings.escalate1Minutes * 60 * 1000;
  const e2Ms = settings.escalate2Minutes * 60 * 1000;
  const missedMs = settings.missedMinutes * 60 * 1000;

  // 1. SCHEDULED -> REMINDED (when now >= due - preMinutes)
  if (dose.status === 'SCHEDULED') {
    if (nowMs >= dueTime.getTime() - preMs) {
      const nextAction = addMinutes(dueTime, settings.escalate1Minutes).toISOString();
      return {
        nextStatus: 'REMINDED',
        nextActionAt: nextAction,
        emails: [
          {
            recipientRole: 'ELDER',
            subject: `CareCircle Reminder: Time to take your ${dose.medName}`,
            doseId: dose.id,
            medName: dose.medName,
            dueAt: dose.dueAt,
            stage: 'REMINDED',
          },
        ],
        isTerminal: false,
      };
    }
  }

  // 2. REMINDED -> ESCALATED_1 (when now >= due + escalate1Minutes)
  if (dose.status === 'REMINDED') {
    if (nowMs >= dueTime.getTime() + e1Ms) {
      const nextAction = addMinutes(dueTime, settings.escalate2Minutes).toISOString();
      return {
        nextStatus: 'ESCALATED_1',
        nextActionAt: nextAction,
        emails: [
          {
            recipientRole: 'CARETAKER',
            subject: `CareCircle Alert: Medication dose missed - ${dose.medName}`,
            doseId: dose.id,
            medName: dose.medName,
            dueAt: dose.dueAt,
            stage: 'ESCALATED_1',
          },
        ],
        isTerminal: false,
      };
    }
  }

  // 3. ESCALATED_1 -> ESCALATED_2 (when now >= due + escalate2Minutes)
  if (dose.status === 'ESCALATED_1') {
    if (nowMs >= dueTime.getTime() + e2Ms) {
      const nextAction = addMinutes(dueTime, settings.missedMinutes).toISOString();
      return {
        nextStatus: 'ESCALATED_2',
        nextActionAt: nextAction,
        emails: [
          {
            recipientRole: 'FAMILY',
            subject: `CareCircle Family Notice: Unresolved dose - ${dose.medName}`,
            doseId: dose.id,
            medName: dose.medName,
            dueAt: dose.dueAt,
            stage: 'ESCALATED_2',
          },
          {
            recipientRole: 'CARETAKER',
            subject: `CareCircle Escalation: Unresolved dose - ${dose.medName}`,
            doseId: dose.id,
            medName: dose.medName,
            dueAt: dose.dueAt,
            stage: 'ESCALATED_2',
          },
        ],
        isTerminal: false,
      };
    }
  }

  // 4. ESCALATED_2 -> MISSED (when now >= due + missedMinutes)
  if (dose.status === 'ESCALATED_2') {
    if (nowMs >= dueTime.getTime() + missedMs) {
      return {
        nextStatus: 'MISSED',
        emails: [
          {
            recipientRole: 'CARETAKER',
            subject: `CareCircle Final Notice: Dose marked MISSED - ${dose.medName}`,
            doseId: dose.id,
            medName: dose.medName,
            dueAt: dose.dueAt,
            stage: 'MISSED',
          },
        ],
        isTerminal: true, // terminal state: drops GSI keys
      };
    }
  }

  return { emails: [], isTerminal: false };
}
