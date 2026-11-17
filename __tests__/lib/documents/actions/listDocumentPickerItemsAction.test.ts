// S-077: listDocumentPickerItemsAction — auth guard tests (S1, S2, S17)

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

// ─── S1: unauthenticated ─────────────────────────────────────────────────────

describe("listDocumentPickerItemsAction — S1: unauthenticated", () => {
  it("returns not_allowed when no session exists", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await listDocumentPickerItemsAction({ kind: "document" });

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(listDocumentPickerItems).not.toHaveBeenCalled();
  });
});

// ─── S2: wrong role ───────────────────────────────────────────────────────────

describe("listDocumentPickerItemsAction — S2: wrong role (customer)", () => {
  it("returns not_allowed when caller is not staff", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await listDocumentPickerItemsAction({ kind: "document" });

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(listDocumentPickerItems).not.toHaveBeenCalled();
  });
});

// ─── S17: suspended user ──────────────────────────────────────────────────────

describe("listDocumentPickerItemsAction — S17: suspended user", () => {
  it("returns not_allowed when staff account is suspended", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await listDocumentPickerItemsAction({ kind: "document" });

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(listDocumentPickerItems).not.toHaveBeenCalled();
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("listDocumentPickerItemsAction — happy path", () => {
  it("returns picker items for authenticated staff", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER });
    vi.mocked(listDocumentPickerItems).mockResolvedValue(PICKER_RESULT);

    const result = await listDocumentPickerItemsAction({ kind: "document" });

    expect(result).toEqual(PICKER_RESULT);
    expect(requireStaff).toHaveBeenCalledWith("articles.*");
    expect(listDocumentPickerItems).toHaveBeenCalledWith({ search: undefined, page: undefined });
  });

  it("forwards search and page to listDocumentPickerItems", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER });
    vi.mocked(listDocumentPickerItems).mockResolvedValue(PICKER_RESULT);

    await listDocumentPickerItemsAction({ kind: "document", search: "safety", page: 2 });

    expect(listDocumentPickerItems).toHaveBeenCalledWith({ search: "safety", page: 2 });
  });
});
