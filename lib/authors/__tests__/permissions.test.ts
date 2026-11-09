// S-052: AC5 — permission matrix

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAdminWriteLimit: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit";
import { listAuthors } from "@/lib/authors/actions/listAuthors";
import { saveAuthor } from "@/lib/authors/actions/saveAuthor";
import { setAuthorActive } from "@/lib/authors/actions/setAuthorActive";

const AUTHOR_ID = "00000000-0000-4000-8000-000000000010";
const UPDATED_AT = "2026-01-01T00:00:00Z";

function makeListChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnThis();
  chain.select = vi.fn().mockReturnThis();
  chain.eq = vi.fn().mockReturnThis();
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("permissions — AC5", () => {
  describe("unauthenticated / no authors.* permission", () => {
    beforeEach(() => {
      (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    });

    it("listAuthors returns not_allowed", async () => {
      const result = await listAuthors({});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("not_allowed");
    });

    it("saveAuthor returns not_allowed", async () => {
      const result = await saveAuthor({ name: "Eve" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("not_allowed");
    });

    it("setAuthorActive returns not_allowed", async () => {
      const result = await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("not_allowed");
    });

    it("writeAuditRow called with permission.denied for listAuthors", async () => {
      await listAuthors({});
      expect(writeAuditRow).toHaveBeenCalledWith(
        expect.objectContaining({ action: "permission.denied" })
      );
    });

    it("writeAuditRow called with permission.denied for saveAuthor", async () => {
      await saveAuthor({ name: "Eve" });
      expect(writeAuditRow).toHaveBeenCalledWith(
        expect.objectContaining({ action: "permission.denied" })
      );
    });

    it("writeAuditRow called with permission.denied for setAuthorActive", async () => {
      await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
      expect(writeAuditRow).toHaveBeenCalledWith(
        expect.objectContaining({ action: "permission.denied" })
      );
    });
  });

  describe("admin with authors.* permission", () => {
    beforeEach(() => {
      (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        user: { id: "00000000-0000-4000-8000-000000000001", claimedRole: "admin" as const },
      });
    });

    it("listAuthors succeeds", async () => {
      makeListChain();
      const result = await listAuthors({});
      expect(result.ok).toBe(true);
    });
  });

  describe("requireStaff called with exact permission string", () => {
    beforeEach(() => {
      (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    });

    it("listAuthors passes authors.* to requireStaff", async () => {
      await listAuthors({});
      expect(requireStaff).toHaveBeenCalledWith("authors.*");
    });

    it("saveAuthor passes authors.* to requireStaff", async () => {
      await saveAuthor({ name: "Eve" });
      expect(requireStaff).toHaveBeenCalledWith("authors.*");
    });

    it("setAuthorActive passes authors.* to requireStaff", async () => {
      await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
      expect(requireStaff).toHaveBeenCalledWith("authors.*");
    });
  });
});
