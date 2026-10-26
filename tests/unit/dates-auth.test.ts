import { describe, it, expect } from "vitest";
import { addDays, dateSpan, dayRange, isDateString, localDateOf, todayIn, instantForLocalDate } from "@/lib/dates";
import { friendlyAuthError, normalizePhone, safeNextPath } from "@/lib/auth-utils";

describe("day boundaries (time-zone aware)", () => {
  it("an IST day runs from 18:30Z the previous day for 24 hours", () => {
    const { start, end } = dayRange("2026-03-10", "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-03-09T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-03-10T18:30:00.000Z");
  });
  it("a late-night IST meal belongs to that local date, not the UTC date", () => {
    // 23:30 IST on 10 Mar = 18:00Z on 10 Mar; 00:30 IST on 11 Mar = 19:00Z on 10 Mar
    expect(localDateOf("2026-03-10T18:00:00Z", "Asia/Kolkata")).toBe("2026-03-10");
    expect(localDateOf("2026-03-10T19:00:00Z", "Asia/Kolkata")).toBe("2026-03-11");
  });
  it("start is inclusive and end is exclusive", () => {
    const { start, end } = dayRange("2026-03-10", "Asia/Kolkata");
    expect(localDateOf(start, "Asia/Kolkata")).toBe("2026-03-10");
    expect(localDateOf(new Date(end.getTime() - 1), "Asia/Kolkata")).toBe("2026-03-10");
    expect(localDateOf(end, "Asia/Kolkata")).toBe("2026-03-11");
  });
  it("handles DST days (23h and 25h) in zones that have DST", () => {
    const spring = dayRange("2026-03-08", "America/New_York");
    const fall = dayRange("2026-11-01", "America/New_York");
    expect((spring.end.getTime() - spring.start.getTime()) / 3_600_000).toBe(23);
    expect((fall.end.getTime() - fall.start.getTime()) / 3_600_000).toBe(25);
  });
  it("todayIn respects the zone", () => {
    const now = new Date("2026-03-10T20:00:00Z"); // 01:30 on 11 Mar in IST
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-03-11");
    expect(todayIn("UTC", now)).toBe("2026-03-10");
  });
  it("instantForLocalDate keeps the chosen local date", () => {
    const now = new Date("2026-03-10T20:00:00Z");
    const t = instantForLocalDate("2026-03-05", "Asia/Kolkata", now);
    expect(localDateOf(t, "Asia/Kolkata")).toBe("2026-03-05");
  });
  it("validates and does arithmetic on dates", () => {
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2026-02-28")).toBe(true);
    expect(isDateString("26-02-28")).toBe(false);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(dateSpan("2026-02-27", "2026-03-01")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
    expect(() => dayRange("nope", "UTC")).toThrow(RangeError);
  });
});

describe("normalizePhone", () => {
  it("normalises common Indian formats to E.164", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("+14155550123")).toBe("+14155550123");
  });
  it("rejects junk", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("abcdefghij")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("allows only same-site relative paths", () => {
    expect(safeNextPath("/log")).toBe("/log");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

describe("friendlyAuthError", () => {
  it("maps known errors and never echoes raw messages", () => {
    expect(friendlyAuthError("Invalid login credentials")).toMatch(/don't match/);
    expect(friendlyAuthError("Token has expired or is invalid")).toMatch(/expired/);
    expect(friendlyAuthError("some internal secret detail xyz")).toBe("Something went wrong. Please try again.");
  });
});
