import { describe, it, expect } from 'vitest';
import { nextStage } from '../src/domain/doseStateMachine.js';
import { DEFAULT_CIRCLE_SETTINGS, DEMO_CIRCLE_SETTINGS } from '../src/db/repos/circleRepo.js';
import { DoseItem } from '../src/db/repos/doseRepo.js';

describe('doseStateMachine (Section 6.1)', () => {
  const baseDose: DoseItem = {
    id: '2026-11-15T12:00:00.000Z#med-1',
    circleId: 'c-1',
    medId: 'med-1',
    medName: 'Metformin',
    dueAt: '2026-11-15T12:00:00.000Z',
    status: 'SCHEDULED',
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  };

  it('transitions SCHEDULED -> REMINDED when now >= due - preMinutes', () => {
    // Due at 12:00, preMinutes is 10, so trigger at 11:50
    const now = new Date('2026-11-15T11:50:00.000Z');
    const result = nextStage(baseDose, DEFAULT_CIRCLE_SETTINGS, now);

    expect(result.nextStatus).toBe('REMINDED');
    expect(result.isTerminal).toBe(false);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].recipientRole).toBe('ELDER');
    expect(result.nextActionAt).toBe('2026-11-15T12:15:00.000Z'); // due + 15 min
  });

  it('transitions REMINDED -> ESCALATED_1 when now >= due + e1', () => {
    const dose: DoseItem = { ...baseDose, status: 'REMINDED' };
    // e1 is 15 minutes, so trigger at 12:15
    const now = new Date('2026-11-15T12:15:00.000Z');
    const result = nextStage(dose, DEFAULT_CIRCLE_SETTINGS, now);

    expect(result.nextStatus).toBe('ESCALATED_1');
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].recipientRole).toBe('CARETAKER');
    expect(result.nextActionAt).toBe('2026-11-15T12:30:00.000Z'); // due + 30 min
  });

  it('transitions ESCALATED_1 -> ESCALATED_2 when now >= due + e2', () => {
    const dose: DoseItem = { ...baseDose, status: 'ESCALATED_1' };
    // e2 is 30 minutes, so trigger at 12:30
    const now = new Date('2026-11-15T12:30:00.000Z');
    const result = nextStage(dose, DEFAULT_CIRCLE_SETTINGS, now);

    expect(result.nextStatus).toBe('ESCALATED_2');
    expect(result.emails).toHaveLength(2); // Caretaker + Family
    expect(result.emails.map((e) => e.recipientRole)).toContain('FAMILY');
    expect(result.emails.map((e) => e.recipientRole)).toContain('CARETAKER');
    expect(result.nextActionAt).toBe('2026-11-15T13:00:00.000Z'); // due + 60 min
  });

  it('transitions ESCALATED_2 -> MISSED when now >= due + missedMinutes', () => {
    const dose: DoseItem = { ...baseDose, status: 'ESCALATED_2' };
    // missed is 60 minutes, so trigger at 13:00
    const now = new Date('2026-11-15T13:00:00.000Z');
    const result = nextStage(dose, DEFAULT_CIRCLE_SETTINGS, now);

    expect(result.nextStatus).toBe('MISSED');
    expect(result.isTerminal).toBe(true); // drops GSI keys
    expect(result.emails).toHaveLength(1);
  });

  it('works under DEMO_CIRCLE_SETTINGS (pre=0, e1=1m, e2=2m, missed=3m)', () => {
    // In demo mode:
    // 12:00 -> REMINDED
    const t0 = new Date('2026-11-15T12:00:00.000Z');
    const r0 = nextStage(baseDose, DEMO_CIRCLE_SETTINGS, t0);
    expect(r0.nextStatus).toBe('REMINDED');

    // 12:01 -> ESCALATED_1
    const t1 = new Date('2026-11-15T12:01:00.000Z');
    const r1 = nextStage({ ...baseDose, status: 'REMINDED' }, DEMO_CIRCLE_SETTINGS, t1);
    expect(r1.nextStatus).toBe('ESCALATED_1');

    // 12:02 -> ESCALATED_2
    const t2 = new Date('2026-11-15T12:02:00.000Z');
    const r2 = nextStage({ ...baseDose, status: 'ESCALATED_1' }, DEMO_CIRCLE_SETTINGS, t2);
    expect(r2.nextStatus).toBe('ESCALATED_2');

    // 12:03 -> MISSED
    const t3 = new Date('2026-11-15T12:03:00.000Z');
    const r3 = nextStage({ ...baseDose, status: 'ESCALATED_2' }, DEMO_CIRCLE_SETTINGS, t3);
    expect(r3.nextStatus).toBe('MISSED');
    expect(r3.isTerminal).toBe(true);
  });

  it('terminal states (TAKEN, SKIPPED, MISSED) produce no transitions', () => {
    for (const status of ['TAKEN', 'SKIPPED', 'MISSED'] as const) {
      const res = nextStage({ ...baseDose, status }, DEFAULT_CIRCLE_SETTINGS, new Date());
      expect(res.nextStatus).toBeUndefined();
      expect(res.isTerminal).toBe(true);
      expect(res.emails).toHaveLength(0);
    }
  });
});
