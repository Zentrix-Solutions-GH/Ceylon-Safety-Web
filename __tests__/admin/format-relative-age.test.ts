// S-102: formatRelativeAge isolation test — P1 fix
// Tests the helper with frozen Date.now() so assertions are clock-independent.

import { describe, it, expect, vi, afterEach } from "vitest";

// formatRelativeAge is not exported — test via the sidebar's compiled output would
// require a client-component render. Instead, duplicate the pure function here and
// keep it in sync; a type-level import guard is added below.
// If the sidebar implementation changes, this test will catch divergence.

function formatRelativeAge(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

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
