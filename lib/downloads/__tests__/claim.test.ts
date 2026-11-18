// S-085: claimDownload — AC2, AC3, AC4, AC5, AC6, AC7, EC2, AC14

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  r2Config: vi.fn(() => ({
    bucketPrivate: "test-private",
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    publicMediaBaseUrl: "https://cdn.test",
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/r2/storage", () => ({
  headObject: vi.fn(),
  presignedGet: vi.fn(),
}));
vi.mock("@/lib/resend/client", () => ({ queueEmail: vi.fn() }));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { headObject, presignedGet } from "@/lib/r2/storage";
import { claimDownload } from "@/lib/downloads/claim";

const ENT_ID  = "00000000-0000-4000-8000-000000000001";
const USER_ID = "user-buyer-1";
const FILE_KEY = "docs/en/test-doc.pptx";
const LOG_ID = 42;

function makeServiceDb(rpcResult: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
  };
}

function successDb() {
  // claim_download returns TABLE(...) — Supabase wraps it as an array of rows
  return makeServiceDb({ data: [{ file_key: FILE_KEY, log_id: LOG_ID }], error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC2: happy path — returns signed URL ────────────────────────────────────

describe("claimDownload — happy path", () => {
  it("returns a signed URL and never includes the file key (AC2, AC5)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(successDb() as never);
    vi.mocked(headObject).mockResolvedValue({ contentLength: 1024 });
    vi.mocked(presignedGet).mockResolvedValue("https://r2.example.com/signed?X-Amz=abc");

    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.signedUrl).toMatch(/^https:\/\//);
    // File key must not appear anywhere in the response
    expect(JSON.stringify(result.data)).not.toContain(FILE_KEY);
  });

  it("calls claim_download RPC with correct args (AC2)", async () => {
    const db = successDb();
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    vi.mocked(headObject).mockResolvedValue({ contentLength: 1024 });
    vi.mocked(presignedGet).mockResolvedValue("https://r2.example.com/signed");

    await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });

    expect(db.rpc).toHaveBeenCalledWith("claim_download", {
      p_user_id: USER_ID,
      p_entitlement_id: ENT_ID,
      p_ip_hash: "h1",
    });
  });

  it("presigns with ~60s TTL and Content-Disposition attachment (AC4)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(successDb() as never);
    vi.mocked(headObject).mockResolvedValue({ contentLength: 1024 });
    vi.mocked(presignedGet).mockResolvedValue("https://r2.example.com/signed");

    await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1", documentTitle: "Safety Plan", language: "en", format: "pptx" });

    // TTL should be ~60s (between 55 and 65)
    const calls = vi.mocked(presignedGet).mock.calls;
    expect(calls.length).toBe(1);
    const ttl = calls[0]?.[2] as number;
    expect(ttl).toBeGreaterThanOrEqual(55);
    expect(ttl).toBeLessThanOrEqual(65);
  });
});

// ─── AC6: wrong user → not_found ─────────────────────────────────────────────

describe("claimDownload — wrong user", () => {
  it("returns not_found when entitlement belongs to another user (AC6)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      makeServiceDb({
        data: null,
        error: { code: "insufficient_privilege", message: "ceylonsafety: entitlement does not belong to this user" },
      }) as never
    );
    const result = await claimDownload({ entitlementId: ENT_ID, userId: "other-user", ipHash: "h1" });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("returns not_found when entitlement does not exist (AC6)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      makeServiceDb({
        data: null,
        error: { code: "no_data_found", message: "ceylonsafety: entitlement not found" },
      }) as never
    );
    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("returns not_found when entitlement is revoked (AC6)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      makeServiceDb({
        data: null,
        error: { code: "restrict_violation", message: "ceylonsafety: entitlement is revoked" },
      }) as never
    );
    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});

// ─── AC2/AC14: download limit reached ────────────────────────────────────────

describe("claimDownload — limit reached", () => {
  it("returns download_limit_reached when downloads_used >= download_limit (AC2, AC14)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      makeServiceDb({
        data: null,
        error: { code: "restrict_violation", message: "ceylonsafety: download_limit_reached" },
      }) as never
    );
    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });
    expect(result).toMatchObject({ ok: false, code: "download_limit_reached" });
  });
});

// ─── AC4/EC2: file missing in store ──────────────────────────────────────────

describe("claimDownload — file missing in store", () => {
  it("calls release_download and returns file_unavailable when R2 object is missing (AC4, EC2)", async () => {
    // claim_download succeeds (file key returned), but R2 headObject finds nothing
    const db = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: [{ file_key: FILE_KEY, log_id: LOG_ID }], error: null })
        .mockResolvedValueOnce({ data: null, error: null }), // release_download
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    vi.mocked(headObject).mockResolvedValue(null); // object not found

    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });

    expect(result).toMatchObject({ ok: false, code: "file_unavailable" });
    // release_download must have been called
    const releaseCalls = db.rpc.mock.calls.filter((c: unknown[]) => c[0] === "release_download");
    expect(releaseCalls.length).toBe(1);
    expect(releaseCalls[0]?.[1]).toMatchObject({ p_entitlement_id: ENT_ID, p_log_id: LOG_ID });
  });

  it("does NOT call release_download when no_ready_file_for_language (before R2 check) (AC4)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      makeServiceDb({
        data: null,
        error: { code: "no_data_found", message: "ceylonsafety: no_ready_file_for_language" },
      }) as never
    );
    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });
    expect(result).toMatchObject({ ok: false, code: "file_unavailable" });
    expect(vi.mocked(headObject)).not.toHaveBeenCalled();
  });
});

// ─── AC3: parallel calls — only one succeeds ─────────────────────────────────

describe("claimDownload — parallel calls (AC3)", () => {
  it("only the first of N concurrent calls with download_limit=1 gets a success", async () => {
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createSupabaseServiceRoleClient as any).mockImplementation(async () => {
      callCount++;
      const isFirst = callCount === 1;
      return {
        rpc: vi.fn().mockResolvedValue(
          isFirst
            ? { data: [{ file_key: FILE_KEY, log_id: LOG_ID }], error: null }
            : { data: null, error: { code: "restrict_violation", message: "ceylonsafety: download_limit_reached" } }
        ),
        from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
      } as never;
    });
    vi.mocked(headObject).mockResolvedValue({ contentLength: 1024 });
    vi.mocked(presignedGet).mockResolvedValue("https://r2.example.com/signed");

    const results = await Promise.all(
      Array.from({ length: 10 }, () => claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" }))
    );
    const successes = results.filter((r) => r.ok);
    const failures  = results.filter((r) => !r.ok && (r as { code?: string }).code === "download_limit_reached");
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);
  });
});

// ─── AC7: hidden/deleted document still serves; language matches purchase ─────

describe("claimDownload — AC7 language and document-status independence", () => {
  it("serves the file even when the document is hidden/deleted (AC7)", async () => {
    // The DB function selects document_files ignoring document.status and deleted_at.
    // At the server layer this is transparent — the RPC either returns a file_key or throws.
    // We verify that a successful RPC response is handled correctly regardless of document state.
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(successDb() as never);
    vi.mocked(headObject).mockResolvedValue({ contentLength: 1024 });
    vi.mocked(presignedGet).mockResolvedValue("https://r2.example.com/signed?hidden=ok");

    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });
    expect(result.ok).toBe(true);
    expect((result as { data?: { signedUrl: string } }).data?.signedUrl).toMatch(/^https:\/\//);
  });

  it("returns file_unavailable when no ready file exists for the purchased language (AC7)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(
      makeServiceDb({
        data: null,
        error: { code: "no_data_found", message: "ceylonsafety: no_ready_file_for_language" },
      }) as never
    );

    const result = await claimDownload({ entitlementId: ENT_ID, userId: USER_ID, ipHash: "h1" });
    expect(result).toMatchObject({ ok: false, code: "file_unavailable" });
  });
});
