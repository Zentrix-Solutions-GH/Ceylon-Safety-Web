// S-038 AC4: writeDenied writes permission.denied when a Super Admin target action is refused.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

import { writeDenied } from "@/lib/audit";

describe("writeDenied", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("AC4: writes permission.denied with actor, entity type and id", async () => {
    await writeDenied("actor-uuid", "profile", "super-admin-uuid");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [row] = mockInsert.mock.calls[0];
    expect(row.action).toBe("permission.denied");
    expect(row.actor_id).toBe("actor-uuid");
    expect(row.entity_type).toBe("profile");
    expect(row.entity_id).toBe("super-admin-uuid");
  });

  it("AC4: throws when insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db error" } });
    await expect(writeDenied("actor-uuid", "profile", "target-uuid")).rejects.toThrow();
  });

  it("AC4: writes one row per refusal (not deduplicated like session_start)", async () => {
    await writeDenied("actor-uuid", "profile", "target-uuid");
    await writeDenied("actor-uuid", "profile", "target-uuid");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
