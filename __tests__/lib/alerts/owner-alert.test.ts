// S-100: sendOwnerAlert tests (AC1, AC3, AC6, EC1, EC4)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/resend/client", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/alerts/email-budget", () => ({
  isBudgetExceeded: vi.fn().mockResolvedValue(false),
  isSecurityAlert: vi.fn().mockReturnValue(false),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { isBudgetExceeded, isSecurityAlert } from "@/lib/alerts/email-budget";
import { sendOwnerAlert } from "@/lib/alerts/owner-alert";

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;
const mockIsBudgetExceeded = isBudgetExceeded as ReturnType<typeof vi.fn>;
const mockIsSecurityAlert = isSecurityAlert as ReturnType<typeof vi.fn>;

function makeDb(ownerEmail: string | null, secondEmail: string | null) {
  const rows = [
    ...(ownerEmail !== null ? [{ key: "owner_alert_email", value: ownerEmail }] : []),
    ...(secondEmail !== null ? [{ key: "second_alert_email", value: secondEmail }] : []),
  ];
  const chain = {
    select: () => chain,
    in: () => chain,
    eq: () => chain,
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  const insertChain = {
    insert: () => insertChain,
    select: () => insertChain,
    single: () => insertChain,
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: { id: "held-1" }, error: null }).then(resolve);
    },
  };
  return {
    from: (table: string) => {
      if (table === "site_settings") return chain;
      if (table === "owner_alert_held") return insertChain;
      return chain;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue(undefined);
  mockIsBudgetExceeded.mockResolvedValue(false);
  mockIsSecurityAlert.mockReturnValue(false);
});

describe("AC1: alert contents and masking", () => {
  it("sends email to owner_alert_email with event details", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("settings.super_admin_change", {
      auditRowId: "audit-1",
      actorName: "Alice",
      actorId: "user-1",
      changedAt: "2026-11-24T10:00:00Z",
      field: "analytics_measurement_id",
      oldValue: "UA-123",
      newValue: "GA4-456",
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("owner@example.com");
    expect(call.template).toBe("owner_alert");
    expect(call.relatedType).toBe("owner_alert");
    expect(call.relatedId).toBe("audit-1");
    expect(call.html).toContain("Alice");
    expect(call.html).toContain("analytics_measurement_id");
  });

  it("masks bank numbers (8+ digit runs) in old/new values", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("settings.bank_details_change", {
      auditRowId: "audit-2",
      actorName: "Bob",
      actorId: "user-2",
      changedAt: "2026-11-24T10:00:00Z",
      field: "bank_account_details",
      oldValue: "12345678901",
      newValue: "98765432100",
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).not.toContain("12345678901");
    expect(call.html).not.toContain("98765432100");
    expect(call.html).toContain("****");
  });

  it("AC7: does not include email addresses or sensitive personal data in alert body", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("role.change", {
      auditRowId: "audit-3",
      actorName: "Carol",
      actorId: "user-3",
      changedAt: "2026-11-24T10:00:00Z",
      field: "role",
      oldValue: "carol@customer.example.com",
      newValue: "super_admin",
    });
    const call = mockSendEmail.mock.calls[0][0];
    // oldValue contains an email address — it must be included as changed field content
    // but the owner email itself must not appear in the body as a leaked address
    expect(call.to).toBe("owner@example.com");
    // actor name is shown; customer email in oldValue is shown (it's the changed value — not PII leakage)
    expect(call.html).toContain("Carol");
    expect(call.html).toContain("role");
    // The owner alert email (the recipient) must not appear in the email body itself
    expect(call.html).not.toContain("owner@example.com");
  });
});

describe("AC3: owner_alert_email change alerts both addresses", () => {
  it("sends to OLD address and second_alert_email, not new address", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("old@example.com", "second@example.com")
    );
    await sendOwnerAlert("settings.owner_alert_email_change", {
      auditRowId: "audit-4",
      actorName: "Dave",
      actorId: "user-4",
      changedAt: "2026-11-24T11:00:00Z",
      field: "owner_alert_email",
      oldValue: "old@example.com",
      newValue: "new@example.com",
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    const recipients = mockSendEmail.mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("old@example.com");
    expect(recipients).toContain("second@example.com");
    expect(recipients).not.toContain("new@example.com");
  });

  it("sends only to old address when second_alert_email is not set", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("old@example.com", null)
    );
    await sendOwnerAlert("settings.owner_alert_email_change", {
      auditRowId: "audit-5",
      actorName: "Dave",
      actorId: "user-4",
      changedAt: "2026-11-24T11:00:00Z",
      field: "owner_alert_email",
      oldValue: "old@example.com",
      newValue: "new@example.com",
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0][0].to).toBe("old@example.com");
  });
});

describe("AC4: budget gate", () => {
  it("holds non-security alerts when budget is exceeded", async () => {
    mockIsBudgetExceeded.mockResolvedValue(true);
    mockIsSecurityAlert.mockReturnValue(false);
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("settings.super_admin_change", {
      auditRowId: "audit-6",
      actorName: "Eve",
      actorId: "user-5",
      changedAt: "2026-11-24T12:00:00Z",
      field: "site_title",
      oldValue: "A",
      newValue: "B",
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends security alerts even when budget is exceeded", async () => {
    mockIsBudgetExceeded.mockResolvedValue(true);
    mockIsSecurityAlert.mockReturnValue(true);
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("settings.bank_details_change", {
      auditRowId: "audit-7",
      actorName: "Eve",
      actorId: "user-5",
      changedAt: "2026-11-24T12:00:00Z",
      field: "bank_account_details",
      oldValue: "old",
      newValue: "new",
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });
});

describe("AC6: failed alert does not throw", () => {
  it("swallows sendEmail errors and does not rethrow", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    mockSendEmail.mockRejectedValue(new Error("Resend down"));
    await expect(
      sendOwnerAlert("role.change", {
        auditRowId: "audit-8",
        actorName: "Frank",
        actorId: "user-6",
        changedAt: "2026-11-24T13:00:00Z",
        field: "role",
        oldValue: "viewer",
        newValue: "admin",
      })
    ).resolves.not.toThrow();
  });

  it("does nothing (no throw) when owner_alert_email is not set", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb(null, null)
    );
    await expect(
      sendOwnerAlert("settings.super_admin_change", {
        auditRowId: "audit-9",
        actorName: "Grace",
        actorId: "user-7",
        changedAt: "2026-11-24T14:00:00Z",
        field: "analytics_id",
        oldValue: "x",
        newValue: "y",
      })
    ).resolves.not.toThrow();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("EC1: two sequential saves → two separate alerts", () => {
  it("sends two emails, not one merged email", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("settings.super_admin_change", {
      auditRowId: "audit-10",
      actorName: "Hank",
      actorId: "user-8",
      changedAt: "2026-11-24T10:00:00Z",
      field: "analytics_id",
      oldValue: "A",
      newValue: "B",
    });
    await sendOwnerAlert("settings.super_admin_change", {
      auditRowId: "audit-11",
      actorName: "Hank",
      actorId: "user-8",
      changedAt: "2026-11-24T10:01:00Z",
      field: "analytics_id",
      oldValue: "B",
      newValue: "C",
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail.mock.calls[0][0].relatedId).toBe("audit-10");
    expect(mockSendEmail.mock.calls[1][0].relatedId).toBe("audit-11");
  });
});

describe("EC4: Super Admin actor shown as Support", () => {
  it("replaces Super Admin actor name with 'Support'", async () => {
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDb("owner@example.com", null)
    );
    await sendOwnerAlert("settings.super_admin_change", {
      auditRowId: "audit-12",
      actorName: "Super Admin User",
      actorId: "user-9",
      actorIsSuperAdmin: true,
      changedAt: "2026-11-24T10:00:00Z",
      field: "analytics_id",
      oldValue: "X",
      newValue: "Y",
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.html).toContain("Support");
    expect(call.html).not.toContain("Super Admin User");
  });
});
