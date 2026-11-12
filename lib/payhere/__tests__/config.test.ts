// S-079 AC9: payhereConfig() throws with a clear message naming the missing variable.
// EC5: sandbox and live vars are separate.

import { describe, it, expect, vi } from "vitest";

const BASE_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "a".repeat(64),
  CRON_SECRET: "cron-secret",
  RESEND_API_KEY: "resend-key",
  EMAIL_FROM: "no-reply@example.com",
  CSP_MODE: "report-only",
  NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL: "https://cdn.example.com",
};

const PAYHERE_KEYS = [
  "NEXT_PUBLIC_PAYHERE_SANDBOX",
  "PAYHERE_SANDBOX_MERCHANT_ID",
  "PAYHERE_SANDBOX_SECRET",
  "PAYHERE_SANDBOX_CHECKOUT_URL",
  "PAYHERE_MERCHANT_ID",
  "PAYHERE_SECRET",
  "PAYHERE_CHECKOUT_URL",
];

// Sets env vars and returns a cleanup function. Call cleanup() after assertions.
async function setupAndImport(overrides: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const key of [...Object.keys(BASE_ENV), ...PAYHERE_KEYS]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, val] of Object.entries(BASE_ENV)) process.env[key] = val;
  for (const [key, val] of Object.entries(overrides)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }

  vi.resetModules();
  vi.doMock("server-only", () => ({}));
  const { payhereConfig } = await import("@/lib/config");

  const cleanup = () => {
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    vi.resetModules();
  };

  return { fn: payhereConfig, cleanup };
}

describe("payhereConfig — AC9 startup failure", () => {
  it("throws with PAYHERE_SANDBOX_MERCHANT_ID when sandbox mode and merchant id missing", async () => {
    const { fn, cleanup } = await setupAndImport({
      NEXT_PUBLIC_PAYHERE_SANDBOX: "true",
      PAYHERE_SANDBOX_SECRET: "test-secret",
    });
    try { expect(() => fn()).toThrow("PAYHERE_SANDBOX_MERCHANT_ID"); }
    finally { cleanup(); }
  });

  it("throws with PAYHERE_SANDBOX_SECRET when sandbox mode and secret missing", async () => {
    const { fn, cleanup } = await setupAndImport({
      NEXT_PUBLIC_PAYHERE_SANDBOX: "true",
      PAYHERE_SANDBOX_MERCHANT_ID: "test-mid",
    });
    try { expect(() => fn()).toThrow("PAYHERE_SANDBOX_SECRET"); }
    finally { cleanup(); }
  });

  it("throws with PAYHERE_MERCHANT_ID when live mode and merchant id missing", async () => {
    const { fn, cleanup } = await setupAndImport({ PAYHERE_SECRET: "live-secret" });
    try { expect(() => fn()).toThrow("PAYHERE_MERCHANT_ID"); }
    finally { cleanup(); }
  });

  it("throws with PAYHERE_SECRET when live mode and secret missing", async () => {
    const { fn, cleanup } = await setupAndImport({ PAYHERE_MERCHANT_ID: "live-mid" });
    try { expect(() => fn()).toThrow("PAYHERE_SECRET"); }
    finally { cleanup(); }
  });

  it("EC5: returns sandbox config when both sandbox vars present", async () => {
    const { fn, cleanup } = await setupAndImport({
      NEXT_PUBLIC_PAYHERE_SANDBOX: "true",
      PAYHERE_SANDBOX_MERCHANT_ID: "sandbox-mid",
      PAYHERE_SANDBOX_SECRET: "sandbox-secret",
    });
    try {
      const result = fn();
      expect(result.merchantId).toBe("sandbox-mid");
      expect(result.isSandbox).toBe(true);
      expect(result.checkoutUrl).toBe("https://sandbox.payhere.lk/pay/checkout");
    } finally { cleanup(); }
  });

  it("EC5: returns live config when NEXT_PUBLIC_PAYHERE_SANDBOX is not set", async () => {
    const { fn, cleanup } = await setupAndImport({
      PAYHERE_MERCHANT_ID: "live-mid",
      PAYHERE_SECRET: "live-secret",
    });
    try {
      const result = fn();
      expect(result.merchantId).toBe("live-mid");
      expect(result.isSandbox).toBe(false);
      expect(result.checkoutUrl).toBe("https://www.payhere.lk/pay/checkout");
    } finally { cleanup(); }
  });
});
