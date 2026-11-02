// S-038 AC1: writeAuditRow writes exactly one row; masks sensitive fields; no secrets.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

import { writeAuditRow } from "@/lib/audit";

describe("writeAuditRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("AC1: inserts exactly one row with required fields", async () => {
    await writeAuditRow({
      action: "article.publish",
      actorId: "actor-uuid",
      entityType: "article",
      entityId: "art-1",
    });

    expect(mockFrom).toHaveBeenCalledWith("admin_audit_log");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [row] = mockInsert.mock.calls[0];
    expect(row).toMatchObject({
      actor_id: "actor-uuid",
      action: "article.publish",
      entity_type: "article",
      entity_id: "art-1",
    });
  });

  it("AC1: stores summary in after._summary", async () => {
    await writeAuditRow({
      action: "price.change",
      actorId: "actor-uuid",
      summary: "Price changed from 500 to 600",
      after: { price: 600 },
    });

    const [row] = mockInsert.mock.calls[0];
    expect(row.after._summary).toBe("Price changed from 500 to 600");
    expect(row.after.price).toBe(600);
  });

  it("AC1 / EC4: masks 8+ digit runs in before/after", async () => {
    await writeAuditRow({
      action: "bank_transfer.approve",
      actorId: "actor-uuid",
      before: { account: "12345678901234", note: "transfer" },
      after: { status: "approved" },
    });

    const [row] = mockInsert.mock.calls[0];
    expect(row.before.account).toBe("***");
    expect(row.before.note).toBe("transfer");
  });

  it("AC1 / EC4: masks nested sensitive values", async () => {
    await writeAuditRow({
      action: "settings.contact_change",
      actorId: "actor-uuid",
      after: { bank: { number: "00112233445566", branch: "Colombo" } },
    });

    const [row] = mockInsert.mock.calls[0];
    expect(row.after.bank.number).toBe("***");
    expect(row.after.bank.branch).toBe("Colombo");
  });

  it("EC1: throws when insert fails — action must not silently succeed", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db error" } });

    await expect(
      writeAuditRow({ action: "article.publish", actorId: "actor-uuid" })
    ).rejects.toThrow();
  });

  it("AC1: before is omitted when not provided", async () => {
    await writeAuditRow({ action: "article.publish", actorId: "actor-uuid" });
    const [row] = mockInsert.mock.calls[0];
    expect(row.before).toBeUndefined();
  });
});
