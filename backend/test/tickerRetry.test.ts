import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processDoseItem, deliver } from '../src/handlers/ticker.js';
import { mailer } from '../src/services/mailer.js';
import { circleRepo } from '../src/db/repos/circleRepo.js';
import { memberRepo } from '../src/db/repos/memberRepo.js';
import { notifRepo } from '../src/db/repos/notifRepo.js';
import { docClient } from '../src/db/client.js';
import { activityService } from '../src/services/activity.js';
import type { DoseItem } from '../src/db/repos/doseRepo.js';
import type { Member } from '../src/db/repos/memberRepo.js';

describe('Ticker retry/revert on delivery failure (Task 6 & Rule 2/3)', () => {
  const baseDose: DoseItem = {
    id: '2026-11-15T09:00:00.000Z#med-1',
    circleId: 'test-circle',
    medId: 'med-1',
    medName: 'Metformin',
    dueAt: '2026-11-15T09:00:00.000Z',
    status: 'SCHEDULED',
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  };

  const sampleMembers: Member[] = [
    {
      memberId: 'elder-1',
      circleId: 'test-circle',
      name: 'Elder Shanti',
      email: 'shanti@example.com',
      role: 'ELDER',
      passcodeHash: 'hash',
      createdAt: '2026-11-15T00:00:00.000Z',
    },
    {
      memberId: 'caretaker-1',
      circleId: 'test-circle',
      name: 'Rajesh Caretaker',
      email: 'rajesh@example.com',
      role: 'CARETAKER',
      passcodeHash: 'hash',
      createdAt: '2026-11-15T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum-length-req!';

    vi.spyOn(circleRepo, 'get').mockResolvedValue({
      circleId: 'test-circle',
      name: 'Test Circle',
      elderName: 'Elder Shanti',
      timezone: 'Asia/Kolkata',
      settings: {
        preMinutes: 10,
        escalate1Minutes: 30,
        escalate2Minutes: 60,
        missedMinutes: 120,
        dailyDigestHourUTC: 2,
        demoMode: false,
      },
      createdAt: '2026-11-15T00:00:00.000Z',
    });

    vi.spyOn(memberRepo, 'listByCircle').mockResolvedValue(sampleMembers);
    vi.spyOn(notifRepo, 'create').mockResolvedValue({} as any);
    vi.spyOn(activityService, 'log').mockResolvedValue({} as any);
  });

  it('reverts dose status back to previous status and increments retryCount when all sends fail', async () => {
    // Due at 09:00, evaluation at 08:52 (within 10-min pre-reminder window -> should transition to REMINDED)
    const evalTime = new Date('2026-11-15T08:52:00.000Z');

    const updateCalls: any[] = [];
    vi.spyOn(docClient, 'send').mockImplementation(async (command: any) => {
      updateCalls.push(command.input);
      return {};
    });

    // Simulate SES failure for all recipients
    vi.spyOn(mailer, 'send').mockResolvedValue({
      success: false,
      error: 'Email address is not verified in SES sandbox',
    });

    const transitioned = await processDoseItem(baseDose, evalTime);

    // Because it reverted, transitioned should return false (did not advance)
    expect(transitioned).toBe(false);

    // Expect initial forward update + subsequent revert update
    expect(updateCalls.length).toBe(2);

    // The second call is the revert:
    const revertInput = updateCalls[1];
    expect(revertInput.UpdateExpression).toContain(':prevStatus');
    expect(revertInput.ExpressionAttributeValues[':prevStatus']).toBe('SCHEDULED');
    expect(revertInput.ExpressionAttributeValues[':nextStatus']).toBe('REMINDED');
    expect(revertInput.ExpressionAttributeValues[':retryCount']).toBe(1);
    expect(revertInput.ExpressionAttributeValues[':open']).toBe('OPEN');
  });

  it('advances anyway without reverting when retry cap (3) is reached so state machine does not stall', async () => {
    const evalTime = new Date('2026-11-15T08:52:00.000Z');

    const updateCalls: any[] = [];
    vi.spyOn(docClient, 'send').mockImplementation(async (command: any) => {
      updateCalls.push(command.input);
      return {};
    });

    vi.spyOn(mailer, 'send').mockResolvedValue({
      success: false,
      error: 'Permanent failure',
    });

    const activitySpy = vi.spyOn(activityService, 'log');

    const doseAtCap: DoseItem = {
      ...baseDose,
      retryCount: 3, // Already at cap
    };

    const transitioned = await processDoseItem(doseAtCap, evalTime);

    // Advances anyway
    expect(transitioned).toBe(true);

    // Only 1 update call made (the forward transition), no revert
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].ExpressionAttributeValues[':nextStatus']).toBe('REMINDED');

    // Logs EMAIL_DELIVERY_FAILED
    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMAIL_DELIVERY_FAILED',
      })
    );
  });

  it('deliver() helper sends per recipient, records notification log, and tallies successes', async () => {
    const mailerSpy = vi.spyOn(mailer, 'send').mockImplementation(async (opts) => {
      if (opts.to.includes('shanti@example.com')) {
        return { success: true, messageId: 'msg-1' };
      }
      return { success: false, error: 'Sandbox blocked' };
    });

    const notifSpy = vi.spyOn(notifRepo, 'create');

    const result = await deliver(
      [
        { recipientRoles: ['ELDER'], subject: 'Time for your Metformin' },
        { recipientRoles: ['CARETAKER'], subject: 'Caretaker alert' },
      ],
      {
        circleId: 'test-circle',
        stage: 'REMINDED',
        members: sampleMembers,
        medName: 'Metformin',
      }
    );

    expect(result.totalAttempted).toBe(2);
    expect(result.successfulSends).toBe(1);
    expect(result.results.length).toBe(2);
    expect(mailerSpy).toHaveBeenCalledTimes(2);
    expect(notifSpy).toHaveBeenCalledTimes(2);
  });
});
