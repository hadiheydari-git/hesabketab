// Jalali calendar helpers (brief §3.3): timestamps stored UTC, displayed
// Jalali in Asia/Tehran; period boundaries follow the Jalali calendar and
// the week starts on Saturday. Pure functions on top of @kashi-ui/persian
// (a dependency-free pure library), usable in worker, web and tests.
import {
  jalaliMonthLength,
  toGregorian,
  toJalali,
  type JalaliDate,
} from "@kashi-ui/persian";

const TEHRAN_TZ = "Asia/Tehran";
const TEHRAN_OFFSET_MINUTES = 210; // +03:30, Iran has no DST since 2022.

const tehranDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TEHRAN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export type TehranParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Split a UTC instant into wall-clock parts in Asia/Tehran. */
export function tehranParts(date: Date): TehranParts {
  const parts: Record<string, string> = {};
  for (const p of tehranDayFormatter.formatToParts(date)) parts[p.type] = p.value;
  const hour = Number(parts.hour) % 24; // some ICU versions emit "24"
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function jalaliKeyOf(j: JalaliDate): string {
  return `${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}`;
}

/** Financial day key (Jalali YYYY-MM-DD in Asia/Tehran) for a UTC instant. */
export function dayKeyOf(date: Date): string {
  const t = tehranParts(date);
  // Construct with LOCAL parts (not Date.UTC): @kashi-ui/persian's
  // toJalali reads local Date parts, so this is timezone-independent.
  return jalaliKeyOf(toJalali(new Date(t.year, t.month - 1, t.day)));
}

/** Financial month key (Jalali YYYY-MM in Asia/Tehran) for a UTC instant. */
export function monthKeyOf(date: Date): string {
  return dayKeyOf(date).slice(0, 7);
}

/** Parse "YYYY-MM-DD" Jalali key into { jy, jm, jd }. */
export function parseJalaliKey(key: string): { jy: number; jm: number; jd: number } {
  const [jy, jm, jd] = key.split("-").map((n) => Number(n));
  if (!jy || !jm || !jd) throw new Error(`invalid jalali key: ${key}`);
  return { jy, jm, jd };
}

/** Jalali key → UTC instant at local Tehran midnight (00:00 +03:30). */
export function jalaliKeyToUtcStart(key: string): Date {
  const { jy, jm, jd } = parseJalaliKey(key);
  const local = toGregorian(jy, jm, jd); // local calendar date (no tz attached)
  return new Date(
    Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0) - TEHRAN_OFFSET_MINUTES * 60_000,
  );
}

/** Jalali key → UTC instant at Tehran end-of-day (23:59:59.999 +03:30). */
export function jalaliKeyToUtcEnd(key: string): Date {
  return new Date(jalaliKeyToUtcStart(key).getTime() + 24 * 60 * 60_000 - 1);
}

/** Jalali weekday: 0 = Saturday … 6 = Friday (week starts on Saturday). */
export function tehranJalaliWeekday(date: Date): number {
  const t = tehranParts(date);
  const jsDay = new Date(Date.UTC(t.year, t.month - 1, t.day)).getUTCDay(); // 0=Sunday..6=Saturday
  return (jsDay + 1) % 7; // Saturday → 0
}

/** First day (Jalali key) of the week (starting Saturday) containing `date`. */
export function weekStartKey(date: Date): string {
  const d = new Date(date.getTime() - tehranJalaliWeekday(date) * 24 * 60 * 60_000);
  return dayKeyOf(d);
}

/** First day key of the Jalali month for a UTC instant. */
export function monthStartKey(date: Date): string {
  return `${monthKeyOf(date)}-01`;
}

/** Last day key of the Jalali month for a UTC instant. */
export function monthEndKey(date: Date): string {
  const monthKey = monthKeyOf(date);
  const { jy, jm } = parseJalaliKey(`${monthKey}-01`);
  return `${monthKey}-${pad2(jalaliMonthLength(jy, jm))}`;
}

/** Previous Jalali month key for "YYYY-MM". */
export function prevMonthKey(monthKey: string): string {
  const { jy, jm } = parseJalaliKey(`${monthKey}-01`);
  return jm === 1 ? `${jy - 1}-12` : `${jy}-${pad2(jm - 1)}`;
}

/** Next Jalali month key for "YYYY-MM". */
export function nextMonthKey(monthKey: string): string {
  const { jy, jm } = parseJalaliKey(`${monthKey}-01`);
  return jm === 12 ? `${jy + 1}-01` : `${jy}-${pad2(jm + 1)}`;
}

/** Current Jalali month key "now" (Tehran). */
export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyOf(now);
}

/** All day keys in a Jalali month (for calendar/heatmap views). */
export function daysInJalaliMonth(monthKey: string): string[] {
  const { jy, jm } = parseJalaliKey(`${monthKey}-01`);
  const len = jalaliMonthLength(jy, jm);
  return Array.from({ length: len }, (_, i) => `${monthKey}-${pad2(i + 1)}`);
}

/** True when `dueKey` (Jalali) is strictly before today (Tehran). */
export function isOverdue(dueKey: string, now: Date = new Date()): boolean {
  return jalaliKeyToUtcEnd(dueKey).getTime() < now.getTime();
}
