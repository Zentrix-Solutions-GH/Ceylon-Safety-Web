// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// AC5: Supabase clients take values from lib/config.ts
// We mock @supabase/ssr and @supabase/supabase-js to capture what URLs and keys
// the factories are called with, without making real network calls.

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ type: "browser" })),
  createServerClient: vi.fn(() => ({ type: "server" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ type: "service-role" })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "a".repeat(64),
  // S-030: required by cspConfig (lib/config.ts imports it at module level)
  CSP_MODE: "report-only",
  NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL: "https://cdn.ceylonsafety.com",
  // S-010: required server setting
  CRON_SECRET: "test-cron-secret",
};

beforeEach(() => {
  for (const [k, v] of Object.entries(VALID_ENV)) {
    process.env[k] = v;
  }
  vi.resetModules();
});

describe("lib/supabase/client — AC5: browser client", () => {
  it("calls createBrowserClient with URL and anon key from publicConfig", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    // client.ts imports from lib/config.public (no server-only)
    const { createSupabaseBrowserClient } = await import(
      "../lib/supabase/client"
    );
    createSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "anon-key-value"
    );
  });
});

describe("lib/supabase/server — AC5: server client", () => {
  it("exports createSupabaseServerClient function", async () => {
    const mod = await import("../lib/supabase/server");
    expect(typeof mod.createSupabaseServerClient).toBe("function");
  });

  it("server client calls createServerClient with URL and anon key from publicConfig", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    const { createSupabaseServerClient } = await import(
      "../lib/supabase/server"
    );
    await createSupabaseServerClient();
    expect(createServerClient).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "anon-key-value",
      expect.any(Object)
    );
  });

  it("exports createSupabaseServiceRoleClient function", async () => {
    const mod = await import("../lib/supabase/server");
    expect(typeof mod.createSupabaseServiceRoleClient).toBe("function");
  });

  it("service-role client uses service role key from serverConfig", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { createSupabaseServiceRoleClient } = await import(
      "../lib/supabase/server"
    );
    createSupabaseServiceRoleClient();
    expect(createClient).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "service-role-key-value",
      expect.any(Object)
    );
  });

  it("service-role client sets persistSession: false", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { createSupabaseServiceRoleClient } = await import(
      "../lib/supabase/server"
    );
    createSupabaseServiceRoleClient();
    const opts = (createClient as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[2];
    expect(opts?.auth?.persistSession).toBe(false);
    expect(opts?.auth?.autoRefreshToken).toBe(false);
  });
});

// ── Failure-path tests (P1) ────────────────────────────────────────────────
describe("lib/supabase — failure path: missing config", () => {
  afterEach(() => {
    for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY", "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"]) {
      delete process.env[k];
    }
    vi.resetModules();
  });

  it("importing client module throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.resetModules();
    await expect(import("../lib/supabase/client")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL"
    );
  });

  it("importing server module throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    await expect(import("../lib/supabase/server")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  });
});
