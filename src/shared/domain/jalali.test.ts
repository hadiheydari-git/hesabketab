import { describe, expect, it } from "vitest";
import {
  dayKeyOf,
  isOverdue,
  jalaliKeyToUtcEnd,
  jalaliKeyToUtcStart,
  monthEndKey,
  monthKeyOf,
  monthStartKey,
  nextMonthKey,
  prevMonthKey,
  tehranJalaliWeekday,
  weekStartKey,
  daysInJalaliMonth,
} from "./jalali";

// Fixed instants: Iran is UTC+03:30 all year (no DST since 2022).
// 2026-11-27T20:30:00Z == 2026-11-28T00:00 Tehran (Saturday).
const SATURDAY_MIDNIGHT_TEHRAN = new Date(Date.UTC(2026, 10, 27, 20, 30));
// 2026-11-27T10:00Z == 2026-11-27T13:30 Tehran (Friday).
const FRIDAY_AFTERNOON_TEHRAN = new Date(Date.UTC(2026, 10, 27, 10, 0));

describe("jalali day keys", () => {
  it("uses the Tehran calendar day, not UTC", () => {
    expect(dayKeyOf(SATURDAY_MIDNIGHT_TEHRAN)).toBe("1405-09-07");
    expect(dayKeyOf(FRIDAY_AFTERNOON_TEHRAN)).toBe("1405-09-06");
    expect(monthKeyOf(SATURDAY_MIDNIGHT_TEHRAN)).toBe("1405-09");
  });

  it("is timezone-independent of the runtime", () => {
    // The key only depends on Tehran wall-clock time, never on process TZ.
    const other = new Date(Date.UTC(2026, 2, 20, 21, 0)); // 2026-03-21 00:30 Tehran → 1405-01-01
    expect(dayKeyOf(other)).toBe("1405-01-01");
  });

  it("converts day keys to UTC start/end instants in Tehran", () => {
    const start = jalaliKeyToUtcStart("1405-09-07");
    const end = jalaliKeyToUtcEnd("1405-09-07");
    expect(start.toISOString()).toBe("2026-11-27T20:30:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60_000 - 1);
  });
});

describe("jalali periods (week starts Saturday)", () => {
  it("maps weekdays: Saturday=0 … Friday=6", () => {
    expect(tehranJalaliWeekday(SATURDAY_MIDNIGHT_TEHRAN)).toBe(0);
    expect(tehranJalaliWeekday(FRIDAY_AFTERNOON_TEHRAN)).toBe(6);
  });

  it("week starts on Saturday", () => {
    // Friday 1405-09-06 belongs to the week starting Saturday 1405-08-30.
    expect(weekStartKey(FRIDAY_AFTERNOON_TEHRAN)).toBe("1405-08-30");
    expect(weekStartKey(SATURDAY_MIDNIGHT_TEHRAN)).toBe("1405-09-07");
  });

  it("month boundaries and neighbours", () => {
    const midMonth = new Date(Date.UTC(2026, 10, 20, 12, 0)); // 1405-08-29
    expect(monthStartKey(midMonth)).toBe("1405-08-01");
    expect(monthEndKey(midMonth)).toBe("1405-08-30"); // Aban has 30 days
    const esfand = new Date(Date.UTC(2027, 2, 1, 12, 0)); // Tehran 2027-03-01 → 1405-12-10
    expect(monthEndKey(esfand)).toBe("1405-12-29");
    expect(prevMonthKey("1405-01")).toBe("1404-12");
    expect(nextMonthKey("1405-12")).toBe("1406-01");
  });

  it("counts days in a Jalali month", () => {
    expect(daysInJalaliMonth("1405-08")).toHaveLength(30);
    expect(daysInJalaliMonth("1405-09")).toHaveLength(30);
    expect(daysInJalaliMonth("1404-12").length).toBeGreaterThanOrEqual(29);
  });

  it("detects overdue due dates", () => {
    const now = new Date(Date.UTC(2026, 10, 27, 12, 0)); // Tehran 1405-09-06 15:30
    expect(isOverdue("1405-09-05", now)).toBe(true);
    expect(isOverdue("1405-09-06", now)).toBe(false); // due today is not overdue
    expect(isOverdue("1405-09-07", now)).toBe(false);
  });
});
