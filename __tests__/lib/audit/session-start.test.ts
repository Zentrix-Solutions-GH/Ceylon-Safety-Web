// S-038 AC2 / EC2: writeSessionStart writes admin.session_start exactly once per session.
// Concurrent calls (two tabs) still produce only one row.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Upstash in-memory fallback (upstashConfig returns null → checkRateLimit uses _memStore)
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

import { writeSessionStart } from "@/lib/audit";

describe("writeSessionStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("AC2: writes admin.session_start on first call", async () => {
    await writeSessionStart("actor-1", "sess-abc");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [row] = mockInsert.mock.calls[0];
    expect(row.action).toBe("admin.session_start");
    expect(row.actor_id).toBe("actor-1");
  });

  it("AC2: second call same actor+session writes no additional row", async () => {
    await writeSessionStart("actor-2", "sess-xyz");
    await writeSessionStart("actor-2", "sess-xyz");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("EC2: concurrent calls same session — only one row written", async () => {
    await Promise.all([
      writeSessionStart("actor-3", "sess-concurrent"),
      writeSessionStart("actor-3", "sess-concurrent"),
      writeSessionStart("actor-3", "sess-concurrent"),
    ]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("AC2: different session for same actor writes again", async () => {
    await writeSessionStart("actor-4", "sess-1");
    await writeSessionStart("actor-4", "sess-2");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("AC2: different actor same session writes again", async () => {
    await writeSessionStart("actor-5", "sess-shared");
    await writeSessionStart("actor-6", "sess-shared");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("P1: concurrent call where first writer fails — waiter also throws (no silent drop)", async () => {
    // First insert fails; second concurrent call must not silently return.
    mockInsert.mockResolvedValueOnce({ error: { message: "transient error" } });
    const [r1, r2] = await Promise.allSettled([
      writeSessionStart("actor-cf", "sess-cf"),
      writeSessionStart("actor-cf", "sess-cf"),
    ]);
    expect(r1.status).toBe("rejected");
    expect(r2.status).toBe("rejected");
    // Only the first writer attempted an insert; the waiter did not.
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("P1: retry after transient insert failure writes the row (no poisoned dedup key)", async () => {
    // First call fails (transient DB error).
    mockInsert.mockResolvedValueOnce({ error: { message: "transient error" } });
    await expect(writeSessionStart("actor-retry", "sess-retry")).rejects.toThrow();

    // Second call (retry) must succeed — the dedup key must not have been set.
    mockInsert.mockResolvedValue({ error: null });
    await writeSessionStart("actor-retry", "sess-retry");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
