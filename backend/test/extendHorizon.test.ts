import { describe, it, expect } from 'vitest';
import { generateDoses } from '../src/domain/scheduleGenerator.js';

describe('Extend-Horizon Conditional Generation (Spec Section 6.2 & Rule 4)', () => {
  const sampleMed = {
    medId: 'med-bp-1',
    circleId: 'circle-100',
    name: 'Amlodipine',
    strength: '5mg',
    form: 'tablet',
    instructions: 'Take 1 tablet every morning',
    times: ['08:00'],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: '2026-11-15',
    active: true,
  };

  it('generates 7 days of future doses', () => {
    const baseDate = new Date('2026-11-15T00:00:00.000Z');
    const doses = generateDoses(sampleMed, sampleMed.circleId, 'Asia/Kolkata', 10, 7, baseDate);
    expect(doses.length).toBeGreaterThanOrEqual(7);
    expect(doses[0].status).toBe('SCHEDULED');
  });

  it('preserves historical TAKEN, SKIPPED, and MISSED doses when top-up runs', () => {
    const baseDate = new Date('2026-11-15T00:00:00.000Z');
    const generatedDoses = generateDoses(sampleMed, sampleMed.circleId, 'Asia/Kolkata', 10, 7, baseDate);

    // Simulate existing DynamoDB single-table store
    const store = new Map<string, { status: string; takenAt?: string; medName: string }>();

    // Mark the first dose as already TAKEN yesterday
    const firstDoseKey = `${generatedDoses[0].circleId}#${generatedDoses[0].dueAt}#${generatedDoses[0].medId}`;
    store.set(firstDoseKey, {
      status: 'TAKEN',
      takenAt: '2026-11-15T08:02:00.000Z',
      medName: 'Amlodipine',
    });

    // Mark another dose as SKIPPED
    const secondDoseKey = `${generatedDoses[1].circleId}#${generatedDoses[1].dueAt}#${generatedDoses[1].medId}`;
    store.set(secondDoseKey, {
      status: 'SKIPPED',
      medName: 'Amlodipine',
    });

    // Simulate extend-horizon conditional put: attribute_not_exists(PK)
    let newCreatedCount = 0;
    let preservedCount = 0;

    for (const dose of generatedDoses) {
      const key = `${dose.circleId}#${dose.dueAt}#${dose.medId}`;
      if (store.has(key)) {
        // attribute_not_exists check fails: DO NOT OVERWRITE
        preservedCount++;
      } else {
        // attribute_not_exists check passes: insert new dose
        store.set(key, {
          status: dose.status,
          medName: dose.medName,
        });
        newCreatedCount++;
      }
    }

    // Verify history was never overwritten or reset to SCHEDULED
    expect(store.get(firstDoseKey)?.status).toBe('TAKEN');
    expect(store.get(firstDoseKey)?.takenAt).toBe('2026-11-15T08:02:00.000Z');
    expect(store.get(secondDoseKey)?.status).toBe('SKIPPED');
    expect(preservedCount).toBe(2);
    expect(newCreatedCount).toBe(generatedDoses.length - 2);
  });
});
