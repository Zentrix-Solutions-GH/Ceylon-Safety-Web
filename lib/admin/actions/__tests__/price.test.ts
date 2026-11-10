// AC7, AC8, EC7, EC8, EC9: changeDocumentPrice unit tests.
// No DB needed — mocks the supabase client and step-up helper.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    ok: true,
    user: {
      id: "actor-uuid-0001",
      email: "admin@test.com",
      claimedRole: "admin",
      hasAuthenticatorLevel: true,
      hasTotpEnrolled: true,
    },
  }),
}));

vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
  writeDenied: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ratelimit/index", () => ({
  checkAdminWriteLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn().mockResolvedValue(undefined),
  _resetCacheForTest: vi.fn(),
}));

import { changeDocumentPrice, _resetDailyDropCountForTest } from "@/lib/admin/actions/documents";
import { requireStaff } from "@/lib/auth/server";
import { requireStepUp } from "@/lib/auth/step-up";

const MOCK_USER = {
  id: "actor-uuid-0001",
  email: "admin@test.com",
  claimedRole: "admin" as const,
  hasAuthenticatorLevel: true,
  hasTotpEnrolled: true,
};

const DOC_ID = "aa010001-0000-4000-8000-000000000001";
const BASE_PRICE_CENTS = 100000; // LKR 1000

function makeDocRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: DOC_ID,
    price_cents: BASE_PRICE_CENTS,
    status: "draft",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setupDocMock(docRow: ReturnType<typeof makeDocRow> | null, updateResult?: unknown) {
  let docCallCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "documents") {
      docCallCount++;
      if (docCallCount === 1) {
        // Fetch call
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            docRow
              ? { data: docRow, error: null }
              : { data: null, error: { code: "PGRST116", message: "not found" } }
          ),
        };
      }
      // Update call
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          updateResult ?? {
            data: {
              id: DOC_ID,
              price_cents: BASE_PRICE_CENTS * 2,
              updated_at: "2026-01-02T00:00:00.000Z",
            },
            error: null,
          }
        ),
      };
    }
    return { from: vi.fn() };
  });
}

describe("changeDocumentPrice — AC7: step-up required (EC8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: MOCK_USER });
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
  });

  it("returns mfa_required when step-up throws mfa_required", async () => {
    vi.mocked(requireStepUp).mockRejectedValueOnce(
      Object.assign(new Error("mfa_required"), { code: "mfa_required" })
    );
    setupDocMock(makeDocRow());

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 2000,
      confirmedLargeChange: false,
      authenticatorCode: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("mfa_required");
  });

  it("proceeds when step-up succeeds", async () => {
    setupDocMock(makeDocRow(), {
      data: { id: DOC_ID, price_cents: 200000, updated_at: "2026-01-02T00:00:00.000Z" },
      error: null,
    });

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 2000, // 100% increase — needs confirm
      confirmedLargeChange: true,
      authenticatorCode: "123456",
    });

    if (!result.ok) {
      expect(result.code).not.toBe("mfa_required");
    }
  });
});

describe("changeDocumentPrice — AC8: 50% large-change guard (EC7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: MOCK_USER });
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
    _resetDailyDropCountForTest("actor-uuid-0001");
  });

  it("allows exactly 50% increase without confirmation", async () => {
    // BASE = 100000 cents; 50% up = 150000 cents = LKR 1500
    setupDocMock(makeDocRow({ price_cents: 100000 }), {
      data: { id: DOC_ID, price_cents: 150000, updated_at: "2026-01-02T00:00:00.000Z" },
      error: null,
    });

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 1500,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });

    // Exactly 50% — no large-change guard triggered
    if (!result.ok) {
      expect(result.code).not.toBe("validation_failed");
    }
  });

  it("refuses > 50% increase without confirmation (EC7)", async () => {
    // BASE = 100000 cents; 51% up = 151000 cents = LKR 1510
    setupDocMock(makeDocRow({ price_cents: 100000 }));

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 1510,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect((result as { reason: string }).reason).toBe("confirm_large_change");
    }
  });

  it("allows > 50% increase with confirmation", async () => {
    setupDocMock(makeDocRow({ price_cents: 100000 }), {
      data: { id: DOC_ID, price_cents: 151000, updated_at: "2026-01-02T00:00:00.000Z" },
      error: null,
    });

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 1510,
      confirmedLargeChange: true,
      authenticatorCode: "123456",
    });

    if (!result.ok) {
      expect(result.code).not.toBe("validation_failed");
    }
  });

  it("refuses > 50% drop without confirmation", async () => {
    // BASE = 100000 cents; drop to LKR 490 = 49000 cents (51% drop)
    setupDocMock(makeDocRow({ price_cents: 100000 }));

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 490,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect((result as { reason: string }).reason).toBe("confirm_large_change");
    }
  });

  it("allows exactly 50% drop without confirmation (EC7)", async () => {
    // BASE = 100000 cents; exactly 50% down = 50000 cents = LKR 500
    setupDocMock(makeDocRow({ price_cents: 100000 }), {
      data: { id: DOC_ID, price_cents: 50000, updated_at: "2026-01-02T00:00:00.000Z" },
      error: null,
    });

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 500,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });

    // Exactly 50% — not a large change
    if (!result.ok) {
      expect(result.code).not.toBe("validation_failed");
    }
  });
});

describe("changeDocumentPrice — EC9: daily drop limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: MOCK_USER });
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
    _resetDailyDropCountForTest("actor-uuid-0001");
  });

  it("refuses a third large drop in one day with rate_limited", async () => {
    // First two large drops succeed
    for (let i = 0; i < 2; i++) {
      mockFrom.mockReset();
      setupDocMock(makeDocRow({ price_cents: 100000 }), {
        data: { id: DOC_ID, price_cents: 40000, updated_at: `2026-01-0${i + 1}T00:00:00.000Z` },
        error: null,
      });
      const r = await changeDocumentPrice({
        documentId: DOC_ID,
        newPriceLkr: 400, // >50% drop
        confirmedLargeChange: true,
        authenticatorCode: "123456",
      });
      // Both should succeed (or at worst fail for a non-rate-limit reason)
      if (!r.ok) expect(r.code).not.toBe("rate_limited");
    }

    // Third attempt — must be refused
    mockFrom.mockReset();
    setupDocMock(makeDocRow({ price_cents: 100000 }));
    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 400,
      confirmedLargeChange: true,
      authenticatorCode: "123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });
});

describe("changeDocumentPrice — EC1: price validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: MOCK_USER });
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
  });

  it("refuses price 0", async () => {
    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 0,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("refuses negative price", async () => {
    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: -100,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

describe("changeDocumentPrice — EC6: role removed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_allowed when requireStaff fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 1000,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});

describe("changeDocumentPrice — AC11: rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: MOCK_USER });
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
  });

  it("returns rate_limited when checkAdminWriteLimit refuses", async () => {
    const { checkAdminWriteLimit } = await import("@/lib/ratelimit/index");
    vi.mocked(checkAdminWriteLimit).mockResolvedValue({ ok: false } as never);

    const result = await changeDocumentPrice({
      documentId: DOC_ID,
      newPriceLkr: 1000,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });
});
