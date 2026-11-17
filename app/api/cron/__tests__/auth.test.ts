import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { cronSecret: "correct-secret-32-chars-xxxxxxxxx" },
  healthchecksConfig: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs")>();
  return {
    ...actual,
    JOB_REGISTRY: { test: vi.fn().mockResolvedValue({ ok: true }) },
    pingHeartbeat: vi.fn().mockResolvedValue(undefined),
  };
});

import { POST, GET } from "../[job]/route";
import { pingHeartbeat } from "@/lib/jobs";

function makeRequest(secret: string | null, job = "test") {
  const headers = new Headers();
  if (secret !== null) headers.set("x-cron-secret", secret);
  return new Request(`https://localhost/api/cron/${job}`, {
    method: "POST",
    headers,
  });
}

describe("cron route auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("POST with no secret returns 401 with empty body", async () => {
    const res = await POST(makeRequest(null), {
      params: Promise.resolve({ job: "test" }),
    });
    expect(res.status).toBe(401);
    // Route returns NextResponse(null) for auth failures — no JSON body
    expect(await res.text()).toBe("");
  });

  it("POST with wrong secret returns 401 with empty body", async () => {
    const res = await POST(makeRequest("wrong-secret"), {
      params: Promise.resolve({ job: "test" }),
    });
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("POST with correct secret and known job returns 200 with ok:true body", async () => {
    const res = await POST(
      makeRequest("correct-secret-32-chars-xxxxxxxxx"),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
  });

  it("POST with correct secret and unknown job returns 404 with empty body", async () => {
    const res = await POST(
      makeRequest("correct-secret-32-chars-xxxxxxxxx"),
      { params: Promise.resolve({ job: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("AC7: pingHeartbeat is called with job name and 'success' after a successful run", async () => {
    await POST(
      makeRequest("correct-secret-32-chars-xxxxxxxxx"),
      { params: Promise.resolve({ job: "test" }) },
    );
    expect(vi.mocked(pingHeartbeat)).toHaveBeenCalledWith("test", "success");
  });
});
