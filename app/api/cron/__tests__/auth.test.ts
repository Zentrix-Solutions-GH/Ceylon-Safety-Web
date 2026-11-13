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
  };
});

import { POST, GET } from "../[job]/route";

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

  it("POST with no secret returns 401", async () => {
    const res = await POST(makeRequest(null), {
      params: Promise.resolve({ job: "test" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST with wrong secret returns 401", async () => {
    const res = await POST(makeRequest("wrong-secret"), {
      params: Promise.resolve({ job: "test" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST with correct secret and known job returns 200", async () => {
    const res = await POST(
      makeRequest("correct-secret-32-chars-xxxxxxxxx"),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(200);
  });

  it("POST with correct secret and unknown job returns 404", async () => {
    const res = await POST(
      makeRequest("correct-secret-32-chars-xxxxxxxxx"),
      { params: Promise.resolve({ job: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});
