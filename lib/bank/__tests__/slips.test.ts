// S-083: uploadBankSlip integration tests (AC1, AC3, AC4, AC5, AC8, EC3–EC6)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  SLIP_MAX_BYTES: 10 * 1024 * 1024,
  r2Config: vi.fn(() => ({
    bucketPrivate: "test-private-bucket",
    bucketPublic: "test-public-bucket",
    accountId: "test-account",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    publicMediaBaseUrl: "https://cdn.test.example.com",
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));
vi.mock("@/lib/r2/storage", () => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/bank/validate", () => ({
  validateSlipFile: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { putObject, deleteObject } from "@/lib/r2/storage";
import { checkRateLimit } from "@/lib/ratelimit";
import { validateSlipFile } from "@/lib/bank/validate";
import { uploadBankSlip } from "@/lib/bank/slips";
import { cancelPendingOrder } from "@/lib/orders/create";

const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);
const mockPutObject = vi.mocked(putObject);
const mockDeleteObject = vi.mocked(deleteObject);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockValidateSlipFile = vi.mocked(validateSlipFile);

const fakeUser = { id: "user-buyer-1", email: "buyer@example.com", status: "active" };
const fakeOrderId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "user-other-99";

function makeFormData(sizeBytes = 100): FormData {
  const bytes = new Uint8Array(sizeBytes);
  bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff; // JPEG magic
  const file = new File([bytes], "slip.jpg", { type: "image/jpeg" });
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const defaults = {
    // .from("orders").select().eq().single()
    orderSelect: { data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" }, error: null },
    // .from("bank_transfer_slips").insert()
    insertSlip: { data: [{ id: "slip-uuid-1" }], error: null },
    // .from("bank_transfer_slips").select().eq() for AC4 / AC7
    slipSelect: { data: [], error: null },
  };
  const cfg = { ...defaults, ...overrides };

  return {
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(cfg.orderSelect),
        };
      }
      if (table === "bank_transfer_slips") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue(cfg.insertSlip),
          single: vi.fn().mockResolvedValue(cfg.slipSelect),
        };
      }
      return {};
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ ok: true } as never);
  mockValidateSlipFile.mockResolvedValue({ ok: true, data: { mimeType: "image/jpeg", sizeBytes: 100 } } as never);
  mockPutObject.mockResolvedValue(undefined);
});

// ─── AC1: auth gate ───────────────────────────────────────────────────────────

describe("uploadBankSlip — AC1: auth gate", () => {
  it("EC3: returns not_allowed when signed out", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("EC3: returns not_allowed for a suspended buyer", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns validation_failed for a non-UUID orderId", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const result = await uploadBankSlip("not-a-uuid", makeFormData());
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });
});

// ─── AC1: order ownership ─────────────────────────────────────────────────────

describe("uploadBankSlip — AC1: order ownership", () => {
  it("returns not_found when the order belongs to another user", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderSelect: { data: { id: fakeOrderId, user_id: otherUserId, status: "pending_verification", payment_provider: "bank_transfer" }, error: null } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("returns not_found when the order does not exist", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderSelect: { data: null, error: { code: "PGRST116" } } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("EC5: returns not_allowed when the order status is not pending_verification", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderSelect: { data: { id: fakeOrderId, user_id: fakeUser.id, status: "paid", payment_provider: "bank_transfer" }, error: null } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns not_found when payment_provider is not bank_transfer", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderSelect: { data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "payhere" }, error: null } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});

// ─── AC5: rate limit ──────────────────────────────────────────────────────────

describe("uploadBankSlip — AC5: rate limit", () => {
  it("returns rate_limited when the rate limit is exceeded", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited" } as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

// ─── AC2: file validation ─────────────────────────────────────────────────────

describe("uploadBankSlip — AC2: file validation", () => {
  it("returns slip_invalid when file validation fails", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    mockValidateSlipFile.mockResolvedValue({ ok: false, code: "slip_invalid" } as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false, code: "slip_invalid" });
  });

  it("returns validation_failed when no file is attached", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    const emptyFd = new FormData();
    const result = await uploadBankSlip(fakeOrderId, emptyFd);
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });
});

// ─── AC3: happy path ──────────────────────────────────────────────────────────

describe("uploadBankSlip — AC3: happy path", () => {
  it("stores the file in R2 and inserts a row on success", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: true });
    expect(mockPutObject).toHaveBeenCalledOnce();
    // key should be generated by server (contains orderId and no original filename)
    const [, key] = mockPutObject.mock.calls[0]!;
    expect(key).toContain(fakeOrderId);
    expect(key).not.toContain("slip.jpg");
  });

  it("AC3: insert payload has status=uploaded, mime_type, size_bytes, order_id, uploaded_by", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const insertMock = vi.fn().mockResolvedValue({ data: [{ id: "slip-uuid-1" }], error: null });
    const db = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" }, error: null }),
          };
        }
        if (table === "bank_transfer_slips") {
          return { insert: insertMock };
        }
        return {};
      }),
    };
    mockCreateClient.mockResolvedValue(db as never);
    await uploadBankSlip(fakeOrderId, makeFormData());
    expect(insertMock).toHaveBeenCalledOnce();
    const [payload] = insertMock.mock.calls[0]!;
    expect(payload).toMatchObject({
      order_id: fakeOrderId,
      uploaded_by: fakeUser.id,
      mime_type: "image/jpeg",
      size_bytes: 100,
      status: "uploaded",
    });
    expect(payload.file_key).toContain(fakeOrderId);
    expect(payload.file_key).not.toContain("slip.jpg");
  });
});

// ─── AC8: atomicity ───────────────────────────────────────────────────────────

describe("uploadBankSlip — AC8: atomicity", () => {
  it("deletes the R2 object when the DB insert fails", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ insertSlip: { data: null, error: { message: "db error" } } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false });
    expect(mockDeleteObject).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(fakeOrderId),
    );
  });

  it("does not call deleteObject when R2 put fails (nothing was stored)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    mockPutObject.mockRejectedValue(new Error("R2 write failed"));
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: false });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });
});

// ─── AC4: multiple slips allowed ─────────────────────────────────────────────

describe("uploadBankSlip — AC4: multiple slips per order", () => {
  it("succeeds even when earlier slips exist for the order", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({
      slipSelect: { data: [{ id: "old-slip", status: "rejected" }], error: null },
    });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(result).toMatchObject({ ok: true });
  });
});

// ─── EC4: concurrent uploads ──────────────────────────────────────────────────

describe("uploadBankSlip — EC4: concurrent uploads", () => {
  it("two simultaneous uploads produce two separate rows with distinct keys", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);

    const insertedKeys: string[] = [];
    const db = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" },
              error: null,
            }),
          };
        }
        if (table === "bank_transfer_slips") {
          return {
            insert: vi.fn().mockImplementation((payload: { file_key: string }) => {
              insertedKeys.push(payload.file_key);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      }),
    };
    mockCreateClient.mockResolvedValue(db as never);

    const [r1, r2] = await Promise.all([
      uploadBankSlip(fakeOrderId, makeFormData()),
      uploadBankSlip(fakeOrderId, makeFormData()),
    ]);

    expect(r1).toMatchObject({ ok: true });
    expect(r2).toMatchObject({ ok: true });
    // Each upload generates a unique server-side key — no collision
    expect(insertedKeys).toHaveLength(2);
    expect(insertedKeys[0]).not.toBe(insertedKeys[1]);
  });
});

// ─── AC7: cancel refused after slip ──────────────────────────────────────────

describe("uploadBankSlip + cancelPendingOrder — AC7: cancel refused with slip", () => {
  it("cancelPendingOrder returns not_allowed when RPC reports slip_uploaded", async () => {
    // This test verifies that cancelPendingOrder propagates not_allowed when the
    // DB cancel function reports a slip is present. The RPC mock simulates what
    // the Postgres function returns when has_slip = true (exercised by pgTAP).
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" },
              error: null,
            }),
          };
        }
        if (table === "bank_transfer_slips") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: { action: "slip_uploaded" }, error: null }),
    };
    mockCreateClient.mockResolvedValue(db as never);

    const uploadResult = await uploadBankSlip(fakeOrderId, makeFormData());
    expect(uploadResult).toMatchObject({ ok: true });

    const cancelResult = await cancelPendingOrder(fakeOrderId);
    expect(cancelResult).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("cancelPendingOrder returns ok when RPC reports cancelled (no slip present)", async () => {
    // Baseline: cancel succeeds when the DB function reports no slip. Confirms
    // that not_allowed is specifically caused by slip_uploaded, not a blanket failure.
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" },
              error: null,
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: { action: "cancelled" }, error: null }),
    };
    mockCreateClient.mockResolvedValue(db as never);

    const cancelResult = await cancelPendingOrder(fakeOrderId);
    expect(cancelResult).toMatchObject({ ok: true });
  });
});

// ─── AC9: no logging of slip data ────────────────────────────────────────────

describe("uploadBankSlip — AC9: no logging of slip data", () => {
  it("does not log file key, mime type, or order id on success", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    await uploadBankSlip(fakeOrderId, makeFormData());
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does not log file key, mime type, or order id on DB insert failure", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ insertSlip: { data: null, error: { message: "db error" } } });
    mockCreateClient.mockResolvedValue(db as never);
    await uploadBankSlip(fakeOrderId, makeFormData());
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does not log file key, mime type, or order id on R2 upload failure", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockPutObject.mockRejectedValue(new Error("r2 error"));
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    await uploadBankSlip(fakeOrderId, makeFormData());
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
