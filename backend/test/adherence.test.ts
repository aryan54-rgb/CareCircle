import { describe, it, expect } from 'vitest';
import { calculateAdherence } from '../src/domain/adherence.js';
import { DoseItem } from '../src/db/repos/doseRepo.js';
import { Medication } from '../src/db/repos/medRepo.js';

describe('adherence (Section 6.8 & Pure Domain)', () => {
  const sampleMeds: Medication[] = [
    {
      medId: 'm1',
      circleId: 'c1',
      name: 'Aspirin',
      strength: '75mg',
      form: 'tablet',
      instructions: '',
      times: ['09:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      active: true,
      pillCount: 3, // <= refillThreshold
      refillThreshold: 5,
      createdAt: '',
      updatedAt: '',
    },
    {
      medId: 'm2',
      circleId: 'c1',
      name: 'Metformin',
      strength: '500mg',
      form: 'tablet',
      instructions: '',
      times: ['09:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-01',
      active: true,
      pillCount: 20,
      refillThreshold: 5,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('calculates deterministic adherence rates and detects low pill count', () => {
    const doses: DoseItem[] = [
      {
        id: '1',
        circleId: 'c1',
        medId: 'm1',
        medName: 'Aspirin',
        dueAt: '2026-11-15T03:30:00.000Z',
        status: 'TAKEN',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        circleId: 'c1',
        medId: 'm1',
        medName: 'Aspirin',
        dueAt: '2026-11-14T03:30:00.000Z',
        status: 'TAKEN',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '3',
        circleId: 'c1',
        medId: 'm2',
        medName: 'Metformin',
        dueAt: '2026-11-15T03:30:00.000Z',
        status: 'MISSED',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '4',
        circleId: 'c1',
        medId: 'm2',
        medName: 'Metformin',
        dueAt: '2026-11-14T03:30:00.000Z',
        status: 'SKIPPED',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const summary = calculateAdherence(doses, sampleMeds, 7, 'Asia/Kolkata');

    expect(summary.totalDoses).toBe(4);
    expect(summary.takenCount).toBe(2);
    expect(summary.missedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.overallRate).toBe(50); // 2 / 4 = 50%

    // Refill alerts: Aspirin has 3 pills left (threshold: 5)
    expect(summary.refillAlerts).toHaveLength(1);
    expect(summary.refillAlerts[0].medName).toBe('Aspirin');
    expect(summary.refillAlerts[0].currentPills).toBe(3);
  });
});
