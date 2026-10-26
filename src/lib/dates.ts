import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Today's calendar date (YYYY-MM-DD) in the given time zone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** The calendar date (YYYY-MM-DD) that an instant falls on in `tz`. */
export function localDateOf(instant: Date | string, tz: string): string {
  return formatInTimeZone(new Date(instant), tz, "yyyy-MM-dd");
}

/**
 * UTC instants bounding a local calendar day: [start, end).
 * Computed from local midnight to next local midnight, so days that are 23 or
 * 25 hours long (DST) are handled correctly.
 */
export function dayRange(date: string, tz: string): { start: Date; end: Date } {
  if (!isDateString(date)) throw new RangeError(`Invalid date: ${date}`);
  const start = fromZonedTime(`${date}T00:00:00`, tz);
  const next = addDays(date, 1);
  const end = fromZonedTime(`${next}T00:00:00`, tz);
  return { start, end };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD dates from `from` to `to`. */
export function dateSpan(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Combine a local date with the current local clock time into a UTC instant. */
export function instantForLocalDate(date: string, tz: string, now: Date = new Date()): Date {
  const time = formatInTimeZone(now, tz, "HH:mm:ss");
  return fromZonedTime(`${date}T${time}`, tz);
}

export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Representative local clock time for meals logged on a past date. */
const DEFAULT_MEAL_TIME: Record<string, string> = {
  breakfast: "08:30:00",
  lunch: "13:00:00",
  dinner: "20:00:00",
  snack: "16:30:00",
};

/**
 * When a meal was eaten. Today: the current instant. Any other day: a sensible
 * local time for that meal type, so the day's ordering reads naturally.
 */
export function consumedAtFor(date: string, tz: string, mealType: string, now: Date = new Date()): Date {
  if (date === todayIn(tz, now)) return now;
  const time = DEFAULT_MEAL_TIME[mealType] ?? "12:00:00";
  return fromZonedTime(`${date}T${time}`, tz);
}
