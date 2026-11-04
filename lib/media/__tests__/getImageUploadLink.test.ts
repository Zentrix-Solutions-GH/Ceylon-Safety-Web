// S-047: getImageUploadLink server action — AC1, AC2, AC3, AC9, EC1, EC-A, EC-B

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  r2Config: vi.fn(() => ({
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucketPublic: "pub-bucket",
    publicMediaBaseUrl: "https://img.example.com",
  })),
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/ratelimit/index", () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({}));
vi.mock("@/lib/r2/storage", () => ({
  presignedPut: vi.fn(),
  _setClientForTest: vi.fn(),
}));

import { requireStaff } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { presignedPut } from "@/lib/r2/storage";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getImageUploadLink } from "@/lib/media/actions/getImageUploadLink";

const STAFF_USER = { id: "aa000001-0000-4000-8000-000000000001", claimedRole: "admin" as const };

function mockRequireStaff(ok: boolean) {
  if (ok) {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER as never });
  } else {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });
  }
}

function mockRateLimit(ok: boolean) {
  vi.mocked(checkRateLimit).mockResolvedValue(
    ok ? { ok: true } : { ok: false, retryAfterSeconds: 3600, reason: "rate_limited" }
  );
}

function makeSupabaseMock(insertError: unknown = null, insertData: unknown = { id: "media-uuid" }, selectData: unknown = null, selectError: unknown = null) {
  const singleInsert = vi.fn().mockResolvedValue({ data: insertData, error: insertError });
  const selectInsert = vi.fn().mockReturnValue({ single: singleInsert });
  const insert = vi.fn().mockReturnValue({ select: selectInsert });

  const singleSelect = vi.fn().mockResolvedValue({ data: selectData, error: selectError });
  const eqSelect = vi.fn().mockReturnValue({ single: singleSelect });
  const selectQ = vi.fn().mockReturnValue({ eq: eqSelect });
  const updateEq = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const update = vi.fn().mockReturnValue(updateEq);

  const from = vi.fn().mockReturnValue({ insert, select: selectQ, update });
  return { from, insert, singleInsert, selectQ, eqSelect, singleSelect };
}

const VALID_INPUT = {
  mimeType: "image/webp" as const,
  variants: [
    { width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const },
    { width: 1200, sizeCap: 400 * 1024, mimeType: "image/webp" as const },
  ] as [{ width: number; sizeCap: number; mimeType: "image/webp" }, { width: number; sizeCap: number; mimeType: "image/webp" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(presignedPut).mockResolvedValue("https://r2.example.com/presigned");
});

describe("getImageUploadLink", () => {
  it("AC1: happy path inserts a pending row and returns one link per variant", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock(null, { id: "media-uuid" });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await getImageUploadLink(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mediaId).toBe("media-uuid");
    expect(result.links).toHaveLength(2);
    expect(result.links[0]!.width).toBe(480);
    expect(result.links[1]!.width).toBe(1200);
    expect(presignedPut).toHaveBeenCalledTimes(2);
  });

  it("AC1: insert payload contains uploaded_by, status=pending, kind=image, bucket=public", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock(null, { id: "media-uuid" });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    await getImageUploadLink(VALID_INPUT);

    expect(sb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        uploaded_by: STAFF_USER.id,
        status: "pending",
        kind: "image",
        bucket: "public",
      })
    );
  });

  it("EC1: no media.upload permission returns not_allowed (auth layer logs the denial)", async () => {
    mockRequireStaff(false);

    const result = await getImageUploadLink(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("AC2: GIF MIME type returns validation_failed and creates no row", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await getImageUploadLink({
      mimeType: "image/gif" as never,
      variants: [{ width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("AC2: SVG MIME type returns validation_failed and creates no row", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await getImageUploadLink({
      mimeType: "image/svg+xml" as never,
      variants: [{ width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("AC2: text/html MIME type returns validation_failed and creates no row", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await getImageUploadLink({
      mimeType: "text/html" as never,
      variants: [{ width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("AC2: application/pdf MIME type returns validation_failed and creates no row", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await getImageUploadLink({
      mimeType: "application/pdf" as never,
      variants: [{ width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("AC2: more than two variants returns validation_failed", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);

    const result = await getImageUploadLink({
      mimeType: "image/webp" as const,
      variants: [
        { width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const },
        { width: 800, sizeCap: 200 * 1024, mimeType: "image/webp" as const },
        { width: 1200, sizeCap: 400 * 1024, mimeType: "image/webp" as const },
      ] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("AC2: variant wider than 1200 px returns validation_failed", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);

    const result = await getImageUploadLink({
      mimeType: "image/webp" as const,
      variants: [{ width: 1600, sizeCap: 400 * 1024, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("AC3: 61st call in an hour returns rate_limited", async () => {
    mockRequireStaff(true);
    mockRateLimit(false);

    const result = await getImageUploadLink(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("rate_limited");
  });

  it("AC3: rate limit is keyed on the staff user id", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock(null, { id: "media-uuid" });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    await getImageUploadLink(VALID_INPUT);

    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: STAFF_USER.id })
    );
  });

  it("EC-A: variant with zero width returns validation_failed", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);

    const result = await getImageUploadLink({
      mimeType: "image/webp" as const,
      variants: [{ width: 0, sizeCap: 120 * 1024, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("EC-A: variant with negative sizeCap returns validation_failed", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);

    const result = await getImageUploadLink({
      mimeType: "image/webp" as const,
      variants: [{ width: 480, sizeCap: -1, mimeType: "image/webp" as const }] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("EC-B: two variants with the same width returns validation_failed", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);

    const result = await getImageUploadLink({
      mimeType: "image/webp" as const,
      variants: [
        { width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const },
        { width: 480, sizeCap: 120 * 1024, mimeType: "image/webp" as const },
      ] as never,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("EC-D: insert file_key contains the actual mediaId UUID so uploads never collide", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const sb = makeSupabaseMock(null, { id: "media-uuid" });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    await getImageUploadLink(VALID_INPUT);

    const payload = sb.insert.mock.calls[0]?.[0] as Record<string, string> | undefined;
    expect(payload).toBeDefined();
    // file_key must contain the same UUID that was inserted as the row id
    expect(payload!.file_key).toContain(payload!.id);
  });

  it("S17: suspended staff member (requireStaff returns not_allowed) is blocked", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await getImageUploadLink(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("AC9: supplying an existing pending mediaId re-issues links for the same row", async () => {
    mockRequireStaff(true);
    mockRateLimit(true);
    const existingRow = { id: "ee000001-0000-4000-8000-000000000001", status: "pending", uploaded_by: STAFF_USER.id, file_key: "images/existing-uuid/abc" };
    const sb = makeSupabaseMock(null, null, existingRow, null);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);
    vi.mocked(presignedPut).mockResolvedValue("https://r2.example.com/signed");

    const result = await getImageUploadLink({ ...VALID_INPUT, mediaId: "ee000001-0000-4000-8000-000000000001" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mediaId).toBe("ee000001-0000-4000-8000-000000000001");
    // Insert must NOT be called — retry re-uses the existing row
    expect(sb.insert).not.toHaveBeenCalled();
    // presignedPut must be called with the existing file_key (not a fresh one)
    expect(presignedPut).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(existingRow.file_key),
      expect.any(String),
      expect.any(Number)
    );
  });
});
