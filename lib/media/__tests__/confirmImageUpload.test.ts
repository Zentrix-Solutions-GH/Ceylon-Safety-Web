// S-047: confirmImageUpload server action — AC4, AC5, AC6, AC7, EC1, EC2, EC3, EC4, EC7, EC-C, EC-E

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
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
  writeDenied: vi.fn(),
}));
vi.mock("@/lib/r2/storage", () => ({
  getObjectBytes: vi.fn(),
  deleteObject: vi.fn(),
  headObject: vi.fn(),
  _setClientForTest: vi.fn(),
}));
vi.mock("@/lib/media/checkRealType", () => ({
  checkRealType: vi.fn(),
}));
vi.mock("@/lib/media/checkGps", () => ({
  checkGps: vi.fn(),
}));
vi.mock("@/lib/media/readDimensions", () => ({
  readDimensions: vi.fn(),
}));

import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow, writeDenied } from "@/lib/audit/index";
import { getObjectBytes, deleteObject, headObject } from "@/lib/r2/storage";
import { checkRealType } from "@/lib/media/checkRealType";
import { checkGps } from "@/lib/media/checkGps";
import { readDimensions } from "@/lib/media/readDimensions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { confirmImageUpload } from "@/lib/media/actions/confirmImageUpload";

const STAFF_USER = { id: "aa000001-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const MEDIA_UUID = "bb000001-0000-4000-8000-000000000001";
const FAKE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic

function mockRequireStaff(ok: boolean) {
  if (ok) {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER as never });
  } else {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });
  }
}

function makePendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MEDIA_UUID,
    status: "pending",
    uploaded_by: STAFF_USER.id,
    file_key: `images/${MEDIA_UUID}/abc123`,
    mime_type: "image/jpeg",
    ...overrides,
  };
}

function makeSupabaseMock(
  row: unknown = makePendingRow(),
  selectError: unknown = null,
  updateError: unknown = null,
  updateAffected: boolean = true  // true = update matched a row (won optimistic lock)
) {
  const singleSelect = vi.fn().mockResolvedValue({ data: row, error: selectError });
  const eqSelect = vi.fn().mockReturnValue({ single: singleSelect });
  // update chain: .update({}).eq("id",...).eq("status","pending").select("id")
  const updateSelect = vi.fn().mockResolvedValue({
    data: updateAffected ? [{ id: MEDIA_UUID }] : [],
    error: updateError,
  });
  const eqUpdate2 = vi.fn().mockReturnValue({ select: updateSelect });
  const eqUpdate1 = vi.fn().mockReturnValue({ eq: eqUpdate2 });
  const update = vi.fn().mockReturnValue({ eq: eqUpdate1 });
  const selectQ = vi.fn().mockReturnValue({ eq: eqSelect });
  const from = vi.fn().mockReturnValue({ select: selectQ, update });
  return { from, singleSelect, update, updateSelect };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireStaff(true);
  vi.mocked(getObjectBytes).mockResolvedValue(FAKE_BYTES);
  vi.mocked(checkRealType).mockReturnValue("image/jpeg");
  vi.mocked(checkGps).mockReturnValue(false);
  vi.mocked(readDimensions).mockReturnValue({ width: 480, height: 320 });
  vi.mocked(headObject).mockResolvedValue({ contentLength: 50 * 1024 });
  vi.mocked(deleteObject).mockResolvedValue(undefined);
  vi.mocked(writeAuditRow).mockResolvedValue(undefined);
});

describe("confirmImageUpload", () => {
  it("EC1: no media.upload permission returns not_allowed and writes permission.denied audit", async () => {
    mockRequireStaff(false);

    const result = await confirmImageUpload("5a3b8f21-0000-4000-8000-000000000001");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
    expect(writeDenied).toHaveBeenCalled();
  });

  it("AC7: happy path marks row ready and writes image.upload audit row", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);
    vi.mocked(readDimensions)
      .mockReturnValueOnce({ width: 480, height: 320 })
      .mockReturnValueOnce({ width: 1200, height: 800 });
    vi.mocked(headObject)
      .mockResolvedValueOnce({ contentLength: 50 * 1024 })
      .mockResolvedValueOnce({ contentLength: 300 * 1024 });

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "image.upload" })
    );
  });

  it("EC2: non-existent mediaId returns not_found and changes nothing", async () => {
    const sb = makeSupabaseMock(null, null);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload("cc000001-0000-4000-8000-000000000099");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
    expect(sb.update).not.toHaveBeenCalled();
  });

  it("EC2: already-ready row returns safe repeat result and changes nothing", async () => {
    const sb = makeSupabaseMock(makePendingRow({ status: "ready" }));
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(true);
    expect(sb.update).not.toHaveBeenCalled();
  });

  it("EC-C: pending row owned by different staff member returns not_found", async () => {
    const sb = makeSupabaseMock(makePendingRow({ uploaded_by: "dd000001-0000-4000-8000-000000000001" }));
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("AC4: SVG renamed .png (real type null/unrecognised) returns upload_failed", async () => {
    vi.mocked(checkRealType).mockReturnValue(null);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
  });

  it("EC3: declared WebP but real type JPEG returns upload_failed", async () => {
    const sb = makeSupabaseMock(makePendingRow({ mime_type: "image/webp" }));
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);
    vi.mocked(checkRealType).mockReturnValue("image/jpeg");

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
  });

  it("EC-E: zero-byte object (empty bytes) returns upload_failed", async () => {
    vi.mocked(getObjectBytes).mockResolvedValue(new Uint8Array(0));
    vi.mocked(checkRealType).mockReturnValue(null);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
  });

  it("AC5: variant over size cap is deleted and returns upload_failed", async () => {
    vi.mocked(headObject)
      .mockResolvedValueOnce({ contentLength: 200 * 1024 }) // 480w: over 120 KB cap
      .mockResolvedValueOnce({ contentLength: 300 * 1024 });
    vi.mocked(readDimensions)
      .mockReturnValueOnce({ width: 480, height: 320 })
      .mockReturnValueOnce({ width: 1200, height: 800 });
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
    expect(deleteObject).toHaveBeenCalled();
  });

  it("AC5: variant with wrong pixel width is deleted and returns upload_failed", async () => {
    vi.mocked(readDimensions)
      .mockReturnValueOnce({ width: 600, height: 400 }) // declared 480, got 600
      .mockReturnValueOnce({ width: 1200, height: 800 });
    vi.mocked(headObject)
      .mockResolvedValueOnce({ contentLength: 50 * 1024 })
      .mockResolvedValueOnce({ contentLength: 300 * 1024 });
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
    expect(deleteObject).toHaveBeenCalled();
  });

  it("AC6: image with GPS data is refused and deleted", async () => {
    vi.mocked(checkGps).mockReturnValue(true);
    vi.mocked(readDimensions)
      .mockReturnValueOnce({ width: 480, height: 320 })
      .mockReturnValueOnce({ width: 1200, height: 800 });
    vi.mocked(headObject)
      .mockResolvedValueOnce({ contentLength: 50 * 1024 })
      .mockResolvedValueOnce({ contentLength: 300 * 1024 });
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
    expect(deleteObject).toHaveBeenCalled();
  });

  it("EC4: R2 error reading a variant leaves row pending and returns upload_failed", async () => {
    vi.mocked(getObjectBytes).mockResolvedValue(null);
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sb.from } as never);

    const result = await confirmImageUpload(MEDIA_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
    // row must stay pending — no update call that sets status=ready
    const updateCalls = sb.update.mock.calls;
    const readyCalls = updateCalls.filter(([data]: Record<string, unknown>[]) =>
      (data as Record<string, unknown>)["status"] === "ready"
    );
    expect(readyCalls).toHaveLength(0);
  });

  it("AC7/EC7: caller that wins the optimistic lock writes the audit row; loser skips it", async () => {
    // Both calls see a pending row and pass all checks.
    // First call wins the lock (update returns 1 row → writes audit).
    // Second call loses the lock (update returns 0 rows → returns ok:true silently, no audit).
    const sbWinner = makeSupabaseMock(makePendingRow(), null, null, true);
    const sbLoser  = makeSupabaseMock(makePendingRow(), null, null, false);

    // Reset to clear any leftover once-values from earlier tests in the suite
    vi.mocked(readDimensions).mockReset()
      .mockReturnValueOnce({ width: 480, height: 320 })
      .mockReturnValueOnce({ width: 1200, height: 800 })
      .mockReturnValueOnce({ width: 480, height: 320 })
      .mockReturnValueOnce({ width: 1200, height: 800 })
      .mockReturnValue({ width: 480, height: 320 }); // safe fallback

    // Winner call
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sbWinner.from } as never);
    const r1 = await confirmImageUpload(MEDIA_UUID);
    expect(r1.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledTimes(1);

    // Loser call — loses optimistic lock (update returns 0 rows)
    vi.mocked(writeAuditRow).mockClear();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: sbLoser.from } as never);
    const r2 = await confirmImageUpload(MEDIA_UUID);
    expect(r2.ok).toBe(true);
    // No audit row written by the loser
    expect(writeAuditRow).not.toHaveBeenCalled();
  });
});
