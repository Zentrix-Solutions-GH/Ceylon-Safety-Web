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
  slDayBoundaries: vi.fn().mockReturnValue({
    startUtc: "2026-11-23T18:30:00.000Z",
    endUtc: "2026-11-24T18:29:59.999Z",
  }),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { currentSlDate, slDayBoundaries } from "@/lib/alerts/email-budget";
import { ownerDigestJob } from "@/lib/jobs/owner-digest";

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockCurrentSlDate = currentSlDate as ReturnType<typeof vi.fn>;
const mockSlDayBoundaries = slDayBoundaries as ReturnType<typeof vi.fn>;

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

  const heldResult = {
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: heldAlerts, error: null }).then(resolve);
    },
  };
  const heldChain: Chain = {
    select: () => ({ lt: () => heldResult }),
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
  mockSlDayBoundaries.mockReturnValue({
    startUtc: "2026-11-23T18:30:00.000Z",
    endUtc: "2026-11-24T18:29:59.999Z",
  });
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

  it("AC5 idempotency: second run returns ok:true when sendEmail resolves silently (duplicate)", async () => {
    // sendEmail swallows the unique-violation internally and returns void.
    // A second ownerDigestJob call must still return ok:true.
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({
        auditRows: [
          { id: "a4", action: "order.paid", created_at: "2026-11-24T05:00:00Z", actor_id: "user-1" },
        ],
        heldAlerts: [],
      })
    );
    const first = await ownerDigestJob();
    const second = await ownerDigestJob();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it("passes DIGEST_ACTIONS filter to admin_audit_log query (not all events)", async () => {
    let capturedInArgs: unknown[] = [];
    const capturingAuditChain: Record<string, (...a: unknown[]) => unknown> = {
      select: () => capturingAuditChain,
      gte: () => capturingAuditChain,
      in: (...args: unknown[]) => {
        capturedInArgs = args;
        return {
          order: () => ({
            then(resolve: (v: unknown) => unknown) {
              return Promise.resolve({ data: [], error: null }).then(resolve);
            },
          }),
        };
      },
    };
    const db = makeDb({ auditRows: [], heldAlerts: [] });
    const originalFrom = db.from.bind(db);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from = (table: string) =>
      table === "admin_audit_log" ? capturingAuditChain : originalFrom(table);
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(db);
    await ownerDigestJob();
    // Second arg to .in() is the action list
    const actionList = capturedInArgs[1] as string[];
    expect(actionList).toContain("order.paid");
    expect(actionList).not.toContain("user.login");
    expect(actionList).not.toContain("admin.session_start");
  });

  it("AC7: digest body does not expose actor_id or other customer PII", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb({
        auditRows: [
          {
            id: "a5",
            action: "order.paid",
            created_at: "2026-11-24T05:00:00Z",
            actor_id: "sensitive-uuid-should-not-appear",
          },
        ],
        heldAlerts: [],
      })
    );
    await ownerDigestJob();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).not.toContain("sensitive-uuid-should-not-appear");
    expect(call.text).not.toContain("sensitive-uuid-should-not-appear");
  });
});
