// S-100: Email budget helper tests (AC4, EC2)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getDayEmailCount,
  isBudgetExceeded,
  isSecurityAlert,
} from "@/lib/alerts/email-budget";
import type { OwnerAlertEvent } from "@/types/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockDb = { from: (...args: any[]) => any };

function makeDb(count: number): MockDb {
  const chain = {
    select: () => chain,
    gte: () => chain,
    lt: () => chain,
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ count, error: null }).then(resolve);
    },
  };
  return { from: () => chain };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDayEmailCount", () => {
  it("counts email_logs rows within the Sri Lanka day boundaries", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(42));
    const count = await getDayEmailCount("2026-11-24");
    expect(count).toBe(42);
  });

  it("returns Infinity on DB error (fail-safe: treat as over-budget)", async () => {
    const errorChain = {
      select: () => errorChain,
      gte: () => errorChain,
      lt: () => errorChain,
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve({ count: null, error: { code: "PGRST301" } }).then(resolve);
      },
    };
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => errorChain });
    const count = await getDayEmailCount("2026-11-24");
    expect(count).toBe(Infinity);
  });

  it("EC2: uses Asia/Colombo timezone (UTC+5:30) for day boundaries", async () => {
    let capturedGte = "";
    let capturedLt = "";
    const chain = {
      select: () => chain,
      gte: (_col: string, val: string) => { capturedGte = val; return chain; },
      lt: (_col: string, val: string) => { capturedLt = val; return chain; },
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve({ count: 0, error: null }).then(resolve);
      },
    };
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => chain });
    await getDayEmailCount("2026-11-24");
    // Asia/Colombo UTC+5:30 → 2026-11-24T00:00 LK = 2026-11-23T18:30:00Z
    expect(capturedGte).toBe("2026-11-23T18:30:00.000Z");
    // 2026-11-25T00:00 LK = 2026-11-24T18:30:00Z
    expect(capturedLt).toBe("2026-11-24T18:30:00.000Z");
  });
});

describe("isBudgetExceeded", () => {
  it("returns false when count < 80", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(79));
    const exceeded = await isBudgetExceeded();
    expect(exceeded).toBe(false);
  });

  it("returns true when count >= 80", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(80));
    const exceeded = await isBudgetExceeded();
    expect(exceeded).toBe(true);
  });
});

describe("isSecurityAlert", () => {
  const securityEvents: OwnerAlertEvent[] = [
    "settings.bank_details_change",
    "settings.owner_alert_email_change",
    "role.change",
    "settings.contact_change",
    "document.language_file_replace",
    "price.drop_over_50pct",
  ];

  it.each(securityEvents)("returns true for security event %s", (event) => {
    expect(isSecurityAlert(event)).toBe(true);
  });

  it("returns false for non-security events", () => {
    expect(isSecurityAlert("settings.super_admin_change" as OwnerAlertEvent)).toBe(false);
    expect(isSecurityAlert("order.csv_export" as OwnerAlertEvent)).toBe(false);
    expect(isSecurityAlert("page.publish_legal" as OwnerAlertEvent)).toBe(false);
  });
});
