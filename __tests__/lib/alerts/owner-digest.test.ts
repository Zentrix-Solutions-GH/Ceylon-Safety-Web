// S-100: Owner digest job tests (AC5, EC3)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/resend/client", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/alerts/email-budget", () => ({
  currentSlDate: vi.fn().mockReturnValue("2026-11-24"),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { currentSlDate } from "@/lib/alerts/email-budget";
import { ownerDigestJob } from "@/lib/jobs/owner-digest";

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockCurrentSlDate = currentSlDate as ReturnType<typeof vi.fn>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chain = Record<string, (...args: any[]) => unknown>;

function makeDb(opts: {
  ownerEmail?: string | null;
  auditRows?: Array<Record<string, unknown>>;
  heldAlerts?: Array<Record<string, unknown>>;
  emailLogInsertError?: { code: string } | null;
}) {
  const ownerEmail = "ownerEmail" in opts ? opts.ownerEmail : "owner@example.com";
  const auditRows = opts.auditRows ?? [];
  const heldAlerts = opts.heldAlerts ?? [];

  const settingsChain: Chain = {
    select: () => settingsChain,
    in: () => settingsChain,
    eq: () => settingsChain,
    then(resolve: (v: unknown) => unknown) {
      const rows = ownerEmail
        ? [{ key: "owner_alert_email", value: ownerEmail }]
        : [];
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };

  const auditChain: Chain = {
    select: () => auditChain,
    gte: () => auditChain,
    in: () => auditChain,
    order: () => ({
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve({ data: auditRows, error: null }).then(resolve);
      },
    }),
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: auditRows, error: null }).then(resolve);
    },
  };

  const heldChain: Chain = {
    select: () => ({
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve({ data: heldAlerts, error: null }).then(resolve);
      },
    }),
    delete: () => ({
      in: () => Promise.resolve({ error: null }),
    }),
  };

  return {
    from: (table: string) => {
      if (table === "site_settings") return settingsChain;
      if (table === "admin_audit_log") return auditChain;
      if (table === "owner_alert_held") return heldChain;
      return settingsChain;
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockSendEmail.mockResolvedValue(undefined);
  mockCurrentSlDate.mockReturnValue("2026-11-24");
});

describe("AC5: owner digest job", () => {
  it("returns ok:true and sends nothing when there are no audit rows and no held alerts", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({ auditRows: [], heldAlerts: [] })
    );
    const result = await ownerDigestJob();
    expect(result.ok).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends one digest email when there are audit rows", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({
        auditRows: [
          { id: "a1", action: "order.paid", created_at: "2026-11-24T05:00:00Z", actor_id: "user-1" },
        ],
        heldAlerts: [],
      })
    );
    const result = await ownerDigestJob();
    expect(result.ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.template).toBe("owner_digest");
    expect(call.to).toBe("owner@example.com");
  });

  it("EC3: idempotent — uses relatedType=owner_digest and relatedId=SL date", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({
        auditRows: [
          { id: "a2", action: "settings.change", created_at: "2026-11-24T05:00:00Z", actor_id: "user-1" },
        ],
      })
    );
    await ownerDigestJob();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.relatedType).toBe("owner_digest");
    // relatedId must be a YYYY-MM-DD string (SL date)
    expect(call.relatedId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes held alerts in the digest body", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({
        auditRows: [],
        heldAlerts: [
          { id: "h1", event: "order.csv_export", detail: { actorName: "Ivan" }, created_at: "2026-11-24T08:00:00Z" },
        ],
      })
    );
    const result = await ownerDigestJob();
    expect(result.ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).toContain("Ivan");
  });

  it("returns ok:true even when owner_alert_email is not set", async () => {
    const db = makeDb({
      ownerEmail: null,
      auditRows: [{ id: "a3", action: "order.paid", created_at: "2026-11-24T05:00:00Z" }],
    });
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockImplementation(() => db);
    const result = await ownerDigestJob();
    expect(result.ok).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
