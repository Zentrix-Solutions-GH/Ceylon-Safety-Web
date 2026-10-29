import { describe, it, expect } from "vitest";
import { formatDate, formatMoney } from "../format";

describe("formatDate()", () => {
  it("AC5: formats a date in Asia/Colombo timezone", () => {
    // UTC 2026-10-17T09:00:00Z = 2026-10-17 14:30 in Asia/Colombo (UTC+5:30)
    const d = new Date("2026-10-17T09:00:00.000Z");
    const result = formatDate(d);
    expect(result).toContain("17");
    expect(result).toContain("Oct");
    expect(result).toContain("2026");
    expect(result).toMatch(/2:30/);
  });

  it("EC4: date around midnight shows Sri Lanka day, not UTC", () => {
    // UTC 2026-10-16T19:00:00Z = 2026-10-17 00:30 Asia/Colombo
    const d = new Date("2026-10-16T19:00:00.000Z");
    const result = formatDate(d);
    // Should show 17 Oct (Sri Lanka day), not 16 Oct (UTC day)
    expect(result).toContain("17");
    expect(result).not.toMatch(/\b16\b/);
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
