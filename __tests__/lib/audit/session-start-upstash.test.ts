// S-038 P2: writeSessionStart Upstash SET NX code path.
// Verifies that:
//   - SET NX is called with the correct key format and 12-hour TTL.
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

let writeSessionStart: (actorId: string, sessionId: string) => Promise<void>;

beforeAll(async () => {
  const mod = await import("@/lib/audit");
  writeSessionStart = mod.writeSessionStart;
});

describe("writeSessionStart — Upstash NX path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue("OK");
    mockDel.mockResolvedValue(1);
    mockInsert.mockResolvedValue({ error: null });
  });

  it("P2: calls SET NX with correct key and 12-hour TTL on first write", async () => {
    await writeSessionStart("actor-nx-1", "sess-nx-1");

    expect(mockSet).toHaveBeenCalledWith(
      "admin-session-start:actor-nx-1:sess-nx-1",
      "1",
      { nx: true, ex: 43200 }
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("P2: skips insert when SET NX returns null (duplicate from another instance)", async () => {
    mockSet.mockResolvedValue(null); // NX returned null → key already exists

    await writeSessionStart("actor-nx-2", "sess-nx-2");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("P2: deletes NX key when insert fails so retry is possible", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db error" } });

    await expect(writeSessionStart("actor-nx-3", "sess-nx-3")).rejects.toThrow();

    // NX key must be rolled back so a future retry can set it again.
    expect(mockDel).toHaveBeenCalledWith("admin-session-start:actor-nx-3:sess-nx-3");
  });
});
