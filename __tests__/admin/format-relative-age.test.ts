// S-102: formatRelativeAge isolation tests — tests the real exported function
import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeAge } from "@/app/admin/format-relative-age";

const BASE = new Date("2026-11-25T12:00:00Z").getTime();

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelativeAge", () => {
  it("returns 'just now' for < 1 minute ago", () => {
    vi.setSystemTime(BASE);
    expect(formatRelativeAge(new Date(BASE - 30_000).toISOString())).toBe("just now");
  });

  it("returns minutes for < 1 hour ago", () => {
    vi.setSystemTime(BASE);
    expect(formatRelativeAge(new Date(BASE - 15 * 60_000).toISOString())).toBe("15m ago");
  });

  it("returns hours for < 24 hours ago", () => {
    vi.setSystemTime(BASE);
    expect(formatRelativeAge(new Date(BASE - 3 * 3_600_000).toISOString())).toBe("3h ago");
  });

  it("returns days for >= 24 hours ago", () => {
    vi.setSystemTime(BASE);
    expect(formatRelativeAge(new Date(BASE - 2 * 86_400_000).toISOString())).toBe("2d ago");
  });

  it("returns exactly 1m ago at 60 seconds", () => {
    vi.setSystemTime(BASE);
    expect(formatRelativeAge(new Date(BASE - 60_000).toISOString())).toBe("1m ago");
  });

  it("returns exactly 1h ago at 60 minutes", () => {
    vi.setSystemTime(BASE);
    expect(formatRelativeAge(new Date(BASE - 60 * 60_000).toISOString())).toBe("1h ago");
  });
});
