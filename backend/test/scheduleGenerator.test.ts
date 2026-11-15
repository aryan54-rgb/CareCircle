import { describe, it, expect } from 'vitest';
import { generateDoses } from '../src/domain/scheduleGenerator.js';

describe('scheduleGenerator (Pure Domain)', () => {
  it('generates 7 days of doses for daily medication (2 times per day)', () => {
    const med = {
      medId: 'med-bp-1',
      name: 'Amlodipine',
      times: ['08:00', '20:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-15',
    };

    const doses = generateDoses(med, 'c-100', 'Asia/Kolkata', 10, 7, new Date('2026-11-15T00:00:00Z'));

    // 7 days * 2 times = 14 doses
    expect(doses.length).toBe(14);
    expect(doses[0].medName).toBe('Amlodipine');
    expect(doses[0].status).toBe('SCHEDULED');
    expect(doses[0].GSI1PK).toBe('OPEN');
    expect(doses[0].dueAt).toBeDefined();
    expect(doses[0].nextActionAt).toBeDefined();

    // Verify nextActionAt is 10 minutes before dueAt
    const dueTime = new Date(doses[0].dueAt).getTime();
    const actionTime = new Date(doses[0].nextActionAt).getTime();
    expect(dueTime - actionTime).toBe(10 * 60 * 1000);
  });

  it('respects specific daysOfWeek filter (e.g. Mon, Wed, Fri)', () => {
    // 1 = Mon, 3 = Wed, 5 = Fri
    const med = {
      medId: 'med-mwf',
      name: 'Dialysis Pill',
      times: ['10:00'],
      daysOfWeek: [1, 3, 5],
      startDate: '2026-11-15', // Sunday
    };

    // 7 days starting Sunday: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6)
    // Mon, Wed, Fri -> 3 doses
    const doses = generateDoses(med, 'c-100', 'Asia/Kolkata', 0, 7, new Date('2026-11-15T00:00:00Z'));
    expect(doses.length).toBe(3);
  });

  it('respects endDate boundary', () => {
    const med = {
      medId: 'med-antibiotic',
      name: 'Amoxicillin',
      times: ['09:00', '21:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-11-15',
      endDate: '2026-11-16', // only 2 days
    };

    const doses = generateDoses(med, 'c-100', 'Asia/Kolkata', 10, 7, new Date('2026-11-15T00:00:00Z'));
    // 2 days * 2 times = 4 doses
    expect(doses.length).toBe(4);
  });
});
