import { describe, it, expect } from "vitest";
import { formatDate, formatMoney } from "../format";

describe("formatDate()", () => {
  it("AC5: formats a date in Asia/Colombo timezone", () => {
    // UTC 2026-10-17T09:00:00Z = 2026-10-17 14:30 in Asia/Colombo (UTC+5:30)
    const d = new Date("2026-10-17T09:00:00.000Z");
    // Pinned to exact en-GB output — if this fails, the ICU format changed.
    expect(formatDate(d)).toBe("17 Oct 2026, 2:30 pm");
  });

  it("EC4: date around midnight shows Sri Lanka day, not UTC", () => {
    // UTC 2026-10-16T19:00:00Z = 2026-10-17 00:30 Asia/Colombo
    const d = new Date("2026-10-16T19:00:00.000Z");
    // Shows 17 Oct (Sri Lanka day), not 16 Oct (UTC day)
    expect(formatDate(d)).toBe("17 Oct 2026, 12:30 am");
  });
});

describe("formatMoney()", () => {
  it("AC5: formats cents as LKR with two decimal places", () => {
    expect(formatMoney(150000)).toBe("LKR 1,500.00");
  });

  it("EC5: formats zero cents", () => {
    expect(formatMoney(0)).toBe("LKR 0.00");
  });

  it("EC5: formats large values above 1,000,000 cents", () => {
    const result = formatMoney(100000000); // 1,000,000.00
    expect(result).toBe("LKR 1,000,000.00");
  });

  it("AC5: formats an odd amount with correct cents", () => {
    expect(formatMoney(99)).toBe("LKR 0.99");
  });
});
