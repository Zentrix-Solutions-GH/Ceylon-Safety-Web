// S-038 AC3: writeSupportRead writes support.read once per item per session.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

import { writeSupportRead } from "@/lib/audit";

describe("writeSupportRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("AC3: writes support.read on first read of an item", async () => {
    await writeSupportRead("sa-1", "sess-1", "order", "order-uuid-1");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [row] = mockInsert.mock.calls[0];
    expect(row.action).toBe("support.read");
    expect(row.entity_type).toBe("order");
    expect(row.entity_id).toBe("order-uuid-1");
  });

  it("AC3: second read of same item in same session writes no row", async () => {
    await writeSupportRead("sa-2", "sess-2", "profile", "user-uuid-1");
    await writeSupportRead("sa-2", "sess-2", "profile", "user-uuid-1");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("AC3: same item different session writes again", async () => {
    await writeSupportRead("sa-3", "sess-a", "order", "order-uuid-2");
    await writeSupportRead("sa-3", "sess-b", "order", "order-uuid-2");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("AC3: different items same session each write a row", async () => {
    await writeSupportRead("sa-4", "sess-4", "order", "order-1");
    await writeSupportRead("sa-4", "sess-4", "order", "order-2");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("AC3: different entity types same id same session each write a row", async () => {
    await writeSupportRead("sa-5", "sess-5", "order", "shared-id");
    await writeSupportRead("sa-5", "sess-5", "profile", "shared-id");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
