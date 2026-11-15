import { DoseItem } from '../db/repos/doseRepo.js';
import { Medication } from '../db/repos/medRepo.js';
import { formatDateInTimezone, DEFAULT_TIMEZONE } from '../lib/time.js';

export interface DayAdherence {
  date: string;
  taken: number;
  skipped: number;
  missed: number;
  total: number;
  rate: number; // 0 - 100
}

export interface MedicationAdherence {
  medId: string;
  medName: string;
  taken: number;
  skipped: number;
  missed: number;
  total: number;
  rate: number; // 0 - 100
  pillCount?: number;
  refillThreshold?: number;
  needsRefill: boolean;
}

export interface AdherenceSummary {
  days: number;
  overallRate: number; // 0 - 100
  totalDoses: number;
  takenCount: number;
  skippedCount: number;
  missedCount: number;
  dailyStats: DayAdherence[];
  medicationStats: MedicationAdherence[];
  refillAlerts: {
    medId: string;
    medName: string;
    currentPills: number;
    threshold: number;
  }[];
}

/**
 * PURE FUNCTION: Deterministically calculates adherence stats and refill alerts
 */
export function calculateAdherence(
  doses: DoseItem[],
  meds: Medication[],
  days: number = 7,
  timeZone: string = DEFAULT_TIMEZONE
): AdherenceSummary {
  // Only count doses that were due and have completed or reached a terminal stage (TAKEN, SKIPPED, MISSED)
  // or REMINDED/ESCALATED in the past
  const completedDoses = doses.filter(
    (d) => d.status === 'TAKEN' || d.status === 'SKIPPED' || d.status === 'MISSED'
  );

  let takenCount = 0;
  let skippedCount = 0;
  let missedCount = 0;

  const dayMap = new Map<string, { taken: number; skipped: number; missed: number }>();
  const medMap = new Map<string, { taken: number; skipped: number; missed: number; name: string }>();

  // Initialize meds
  for (const med of meds) {
    medMap.set(med.medId, { taken: 0, skipped: 0, missed: 0, name: med.name });
  }

  for (const dose of completedDoses) {
    const dayStr = formatDateInTimezone(dose.dueAt, timeZone);
    if (!dayMap.has(dayStr)) {
      dayMap.set(dayStr, { taken: 0, skipped: 0, missed: 0 });
    }
    const dayEntry = dayMap.get(dayStr)!;

    if (!medMap.has(dose.medId)) {
      medMap.set(dose.medId, { taken: 0, skipped: 0, missed: 0, name: dose.medName });
    }
    const medEntry = medMap.get(dose.medId)!;

    if (dose.status === 'TAKEN') {
      takenCount++;
      dayEntry.taken++;
      medEntry.taken++;
    } else if (dose.status === 'SKIPPED') {
      skippedCount++;
      dayEntry.skipped++;
      medEntry.skipped++;
    } else if (dose.status === 'MISSED') {
      missedCount++;
      dayEntry.missed++;
      medEntry.missed++;
    }
  }

  const totalDoses = takenCount + skippedCount + missedCount;
  const overallRate = totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 100;

  // Build daily stats (sorted chronologically)
  const dailyStats: DayAdherence[] = Array.from(dayMap.entries())
    .map(([date, counts]) => {
      const total = counts.taken + counts.skipped + counts.missed;
      const rate = total > 0 ? Math.round((counts.taken / total) * 100) : 100;
      return {
        date,
        taken: counts.taken,
        skipped: counts.skipped,
        missed: counts.missed,
        total,
        rate,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Build medication stats and refill alerts
  const refillAlerts: AdherenceSummary['refillAlerts'] = [];
  const medicationStats: MedicationAdherence[] = [];

  for (const med of meds) {
    const counts = medMap.get(med.medId) || { taken: 0, skipped: 0, missed: 0, name: med.name };
    const total = counts.taken + counts.skipped + counts.missed;
    const rate = total > 0 ? Math.round((counts.taken / total) * 100) : 100;

    const needsRefill =
      typeof med.pillCount === 'number' &&
      typeof med.refillThreshold === 'number' &&
      med.pillCount <= med.refillThreshold;

    if (needsRefill && med.pillCount !== undefined && med.refillThreshold !== undefined) {
      refillAlerts.push({
        medId: med.medId,
        medName: med.name,
        currentPills: med.pillCount,
        threshold: med.refillThreshold,
      });
    }

    medicationStats.push({
      medId: med.medId,
      medName: med.name,
      taken: counts.taken,
      skipped: counts.skipped,
      missed: counts.missed,
      total,
      rate,
      pillCount: med.pillCount,
      refillThreshold: med.refillThreshold,
      needsRefill,
    });
  }

  return {
    days,
    overallRate,
    totalDoses,
    takenCount,
    skippedCount,
    missedCount,
    dailyStats,
    medicationStats,
    refillAlerts,
  };
}
