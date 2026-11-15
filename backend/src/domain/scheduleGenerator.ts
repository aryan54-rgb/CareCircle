import { timeStringToUTC, addMinutes, addDays, formatDateInTimezone, DEFAULT_TIMEZONE } from '../lib/time.js';

export interface MedicationScheduleInput {
  medId: string;
  name: string;
  times: string[]; // ['09:00', '21:00']
  daysOfWeek?: number[]; // [0, 1, 2, 3, 4, 5, 6] (0 = Sunday)
  startDate: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
}

export interface GeneratedDose {
  circleId: string;
  medId: string;
  medName: string;
  dueAt: string; // UTC ISO
  status: 'SCHEDULED';
  nextActionAt: string; // UTC ISO
  GSI1PK: 'OPEN';
  GSI1SK: string; // same as nextActionAt
}

/**
 * PURE FUNCTION: Generates scheduled dose events for a medication over a horizon
 * @param med Medication definition
 * @param circleId The circle ID
 * @param timeZone Timezone (e.g. 'Asia/Kolkata')
 * @param preMinutes Reminder minutes before due time (e.g. 10, or 0 in demo mode)
 * @param horizonDays Number of days to generate ahead (default 7)
 * @param fromDate Optional starting date (defaults to today)
 */
export function generateDoses(
  med: MedicationScheduleInput,
  circleId: string,
  timeZone: string = DEFAULT_TIMEZONE,
  preMinutes: number = 10,
  horizonDays: number = 7,
  fromDate: Date = new Date()
): GeneratedDose[] {
  const doses: GeneratedDose[] = [];
  const allowedDays = med.daysOfWeek && med.daysOfWeek.length > 0 ? med.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const currentDay = addDays(fromDate, dayOffset);
    const dayStr = formatDateInTimezone(currentDay, timeZone);

    // Check bounds against startDate and endDate
    if (dayStr < med.startDate) continue;
    if (med.endDate && dayStr > med.endDate) continue;

    // Check day of week in target timezone
    const dayOfWeek = new Date(dayStr + 'T12:00:00Z').getUTCDay();
    if (!allowedDays.includes(dayOfWeek)) continue;

    for (const timeStr of med.times) {
      const dueAtUTC = timeStringToUTC(dayStr, timeStr, timeZone);
      const nextActionAt = addMinutes(dueAtUTC, -preMinutes).toISOString();

      doses.push({
        circleId,
        medId: med.medId,
        medName: med.name,
        dueAt: dueAtUTC,
        status: 'SCHEDULED',
        nextActionAt,
        GSI1PK: 'OPEN',
        GSI1SK: nextActionAt,
      });
    }
  }

  // Sort chronologically
  return doses.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
