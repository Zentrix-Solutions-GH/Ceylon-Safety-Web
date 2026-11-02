// S-038 P2: writeSupportRead Upstash SET NX code path.
// Verifies that:
//   - SET NX is called with the correct key format and 24-hour TTL.
//   - No audit row is written when SET NX returns null (duplicate from another instance).
//   - On insert failure, the NX key is deleted so a future retry can attempt again.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/config.upstash", () => ({
  upstashConfig: vi.fn().mockReturnValue({
    url: "https://fake.upstash.io",
    token: "fake-token",
    hashSecret: "fake-secret",
  }),
}));

const mockSet = vi.fn();
const mockDel = vi.fn();
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    set: mockSet,
    del: mockDel,
  })),
}));

const mockInsert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: vi.fn(() => ({ insert: mockInsert })) })),
}));

let writeSupportRead: (
  actorId: string,
  sessionId: string,
  entityType: string,
  entityId: string
) => Promise<void>;

beforeAll(async () => {
  const mod = await import("@/lib/audit");
  writeSupportRead = mod.writeSupportRead;
});

describe("writeSupportRead — Upstash NX path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue("OK");
    mockDel.mockResolvedValue(1);
    mockInsert.mockResolvedValue({ error: null });
  });

  it("P2: calls SET NX with correct key and 24-hour TTL on first read", async () => {
    await writeSupportRead("sa-nx-1", "sess-nx-1", "order", "order-id-1");

    expect(mockSet).toHaveBeenCalledWith(
      "support-read:sa-nx-1:sess-nx-1:order:order-id-1",
      "1",
      { nx: true, ex: 86400 }
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("P2: skips insert when SET NX returns null (duplicate from another instance)", async () => {
    mockSet.mockResolvedValue(null);

    await writeSupportRead("sa-nx-2", "sess-nx-2", "profile", "user-id-2");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("P2: deletes NX key when insert fails so retry is possible", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db error" } });

    await expect(
      writeSupportRead("sa-nx-3", "sess-nx-3", "order", "order-id-3")
    ).rejects.toThrow();

    expect(mockDel).toHaveBeenCalledWith(
      "support-read:sa-nx-3:sess-nx-3:order:order-id-3"
    );
  });
});
