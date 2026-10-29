// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const importFresh = async (module: string) => {
  vi.resetModules();
  return import(/* @vite-ignore */ `${module}?t=${Date.now()}`);
};

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "a".repeat(64),
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const env = { ...VALID_ENV, ...overrides };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearEnv() {
  for (const k of Object.keys(VALID_ENV)) delete process.env[k];
}

describe("lib/config — AC2: happy path", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("returns publicConfig with Supabase URL and anon key", async () => {
    const { publicConfig } = await importFresh("../lib/config");
    expect(publicConfig.supabaseUrl).toBe("https://abc.supabase.co");
    expect(publicConfig.supabaseAnonKey).toBe("anon-key-value");
  });

  it("returns serverConfig with service-role key and encryption key", async () => {
    const { serverConfig } = await importFresh("../lib/config");
    expect(serverConfig.supabaseServiceRoleKey).toBe("service-role-key-value");
    expect(serverConfig.encryptionKey).toBe("a".repeat(64));
  });
});

describe("lib/config — AC3: missing / invalid settings — all names reported together", () => {
  afterEach(() => clearEnv());

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL"
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  });

  it("throws when NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is missing", async () => {
    setEnv({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: undefined });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"
    );
  });

  it("treats whitespace-only value as missing (EC1)", async () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: "   " });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL"
    );
  });

  it("throws when NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is wrong length", async () => {
    setEnv({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "abc" });
    await expect(importFresh("../lib/config")).rejects.toThrow(
      "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"
    );
  });

  it("reports ALL failing variable names in one error (AC3: plural)", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });
    try {
      await importFresh("../lib/config");
      expect.fail("should have thrown");
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(msg).toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("error message lists setting name but not its invalid value (EC2)", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url-super-secret-value" });
    try {
      await importFresh("../lib/config");
      expect.fail("should have thrown");
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("not-a-url-super-secret-value");
      expect(msg).toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });

  it("error for wrong-length encryption key does not contain the key value (EC2)", async () => {
    const badKey = "b".repeat(32); // wrong length, looks like a secret
    setEnv({ NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: badKey });
    try {
      await importFresh("../lib/config");
      expect.fail("should have thrown");
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).not.toContain(badKey);
      expect(msg).toContain("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY");
    }
  });
});

describe("lib/config — AC4: server-only protection", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("serverConfig is accessible in a Node (server) environment", async () => {
    const { serverConfig } = await importFresh("../lib/config");
    // In node env (no window), serverConfig properties are accessible
    expect(serverConfig.supabaseServiceRoleKey).toBe("service-role-key-value");
    expect(serverConfig.encryptionKey).toBe("a".repeat(64));
  });

  it("publicConfig is accessible without server-only restriction", async () => {
    const { publicConfig } = await importFresh("../lib/config");
    expect(publicConfig.supabaseUrl).toBe("https://abc.supabase.co");
  });
});
