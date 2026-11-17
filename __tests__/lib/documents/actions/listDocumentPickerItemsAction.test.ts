// S-077: listDocumentPickerItemsAction — auth guard tests (S1, S2, S3, S17)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));

vi.mock("@/lib/documents/public", () => ({
  listDocumentPickerItems: vi.fn(),
}));

import { requireStaff } from "@/lib/auth/server";
import { listDocumentPickerItems } from "@/lib/documents/public";
import { listDocumentPickerItemsAction } from "@/lib/documents/actions/listDocumentPickerItemsAction";

const STAFF_USER = {
  id: "a0000000-0000-4000-8000-000000000001",
  email: "editor@example.com",
  claimedRole: "editor" as const,
  hasAuthenticatorLevel: true,
  hasTotpEnrolled: true,
};

const PICKER_RESULT = {
  ok: true as const,
  items: [
    {
      id: "doc-1",
      slug: "safety-checklist",
      title: "Safety Checklist",
      coverImageKey: null,
      priceCents: 150000,
      kind: "document" as const,
    },
  ],
  hasMore: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── S1 / S2 / S17: auth denial propagated ───────────────────────────────────
// requireStaff already distinguishes the three failure modes internally.
// The action's contract is: any {ok:false} from requireStaff short-circuits
// and prevents any call to listDocumentPickerItems.

describe.each([
  ["S1: unauthenticated",    { ok: false as const, code: "not_allowed" as const }],
  ["S2: wrong role",         { ok: false as const, code: "not_allowed" as const }],
  ["S17: suspended user",    { ok: false as const, code: "not_allowed" as const }],
])("listDocumentPickerItemsAction — %s", (_label, authResult) => {
  it("returns not_allowed and never calls listDocumentPickerItems", async () => {
    vi.mocked(requireStaff).mockResolvedValue(authResult);

    const result = await listDocumentPickerItemsAction({});

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(listDocumentPickerItems).not.toHaveBeenCalled();
  });
});

// ─── S3: malformed input ─────────────────────────────────────────────────────

describe("listDocumentPickerItemsAction — S3: malformed input", () => {
  it("returns unknown when input fails Zod validation (page < 1) without calling requireStaff", async () => {
    const result = await listDocumentPickerItemsAction({ page: 0 });

    expect(result).toEqual({ ok: false, code: "unknown" });
    expect(requireStaff).not.toHaveBeenCalled();
    expect(listDocumentPickerItems).not.toHaveBeenCalled();
  });

  it("coerces undefined page to default 1 and forwards to listDocumentPickerItems", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER });
    vi.mocked(listDocumentPickerItems).mockResolvedValue(PICKER_RESULT);

    const result = await listDocumentPickerItemsAction({});

    expect(result.ok).toBe(true);
    expect(listDocumentPickerItems).toHaveBeenCalledWith({ search: undefined, page: 1 });
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("listDocumentPickerItemsAction — happy path", () => {
  it("returns picker items for authenticated staff", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER });
    vi.mocked(listDocumentPickerItems).mockResolvedValue(PICKER_RESULT);

    const result = await listDocumentPickerItemsAction({});

    expect(result).toEqual(PICKER_RESULT);
    expect(requireStaff).toHaveBeenCalledWith("articles.*");
    expect(listDocumentPickerItems).toHaveBeenCalledWith({ search: undefined, page: 1 });
  });

  it("forwards search and page to listDocumentPickerItems", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER });
    vi.mocked(listDocumentPickerItems).mockResolvedValue(PICKER_RESULT);

    await listDocumentPickerItemsAction({ search: "safety", page: 2 });

    expect(listDocumentPickerItems).toHaveBeenCalledWith({ search: "safety", page: 2 });
  });
});
