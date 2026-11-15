export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function nowISO(): string {
  return new Date().toISOString();
}

export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function addMinutes(date: Date | string, minutes: number): Date {
  const d = new Date(date);
  return new Date(d.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function toEpochSeconds(date: Date | string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

/**
 * Format a Date to YYYY-MM-DD in a given timezone
 */
export function formatDateInTimezone(date: Date | string, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Parses time HH:mm and a base date in timezone, returning UTC ISO string
 */
export function timeStringToUTC(dateStr: string, timeStr: string, timeZone: string = DEFAULT_TIMEZONE): string {
  // dateStr is YYYY-MM-DD, timeStr is HH:mm
  // We can construct ISO-like string and determine UTC offset
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Approximate offset for Asia/Kolkata is +05:30. In production Intl gives exact wall time
  const targetDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  
  // Refine using Intl to match the given timezone exactly
  const invDate = new Date(
    targetDate.toLocaleString('en-US', { timeZone: 'UTC' })
  );
  const tzDate = new Date(
    targetDate.toLocaleString('en-US', { timeZone })
  );
  const diff = tzDate.getTime() - invDate.getTime();
  return new Date(targetDate.getTime() - diff).toISOString();
}
