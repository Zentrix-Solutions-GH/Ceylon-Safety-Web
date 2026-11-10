/**
 * S-071 AC6: Integration tests for listDocumentPickerItems with real Supabase.
 * Run with: DOCUMENTS_PUBLIC_DB_TEST=1 npx vitest run lib/documents/__tests__/picker.db.test.ts
 * Requires: local Supabase running with dev seed applied.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Hoist the mock fn so vi.mock() factory can reference it and beforeEach can reset it.
const mockRequireStaff = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/server", () => ({ requireStaff: mockRequireStaff }));

const ENABLED = process.env.DOCUMENTS_PUBLIC_DB_TEST === "1";

// Seed admin user: 02000010-0000-0000-0000-000000000003 (admin@dev.invalid, role=admin)
// Seed customer user: 02000010-0000-0000-0000-000000000004 (customer@dev.invalid, no staff role)

describe.skipIf(!ENABLED)("listDocumentPickerItems — picker permission (AC6)", () => {
  beforeEach(() => {
    mockRequireStaff.mockReset();
  });

  it("staff with articles.* permission can list picker items", async () => {
    mockRequireStaff.mockResolvedValue({
      ok: true,
      user: {
        id: "02000010-0000-0000-0000-000000000003",
        email: "admin@dev.invalid",
        claimedRole: "admin",
        hasAuthenticatorLevel: true,
        hasTotpEnrolled: true,
      },
    });

    const { listDocumentPickerItems } = await import("@/lib/documents/public");
    const result = await listDocumentPickerItems({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    // AC2 guard: no file_key in picker items
    for (const item of result.items) {
      expect(item).not.toHaveProperty("file_key");
      expect(item).not.toHaveProperty("fileKey");
    }
  });

  it("customer (no staff role) cannot list picker items", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });

    const { listDocumentPickerItems } = await import("@/lib/documents/public");
    const result = await listDocumentPickerItems({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("unauthenticated user cannot list picker items", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });

    const { listDocumentPickerItems } = await import("@/lib/documents/public");
    const result = await listDocumentPickerItems({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });
});
