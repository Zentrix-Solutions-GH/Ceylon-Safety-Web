// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

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
});
