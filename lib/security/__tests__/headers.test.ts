import { describe, it, expect, beforeEach, vi } from "vitest";

// We test the builder functions directly, not via config so we can vary inputs.
// Import after env is set so config.ts does not throw during module load.

const SUPABASE_URL = "https://abc.supabase.co";
const IMAGE_CDN = "https://cdn.ceylonsafety.com";
const APP_URL = "https://ceylonsafety.com";

function makeEnv(extra: Record<string, string> = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "srk",
    R2_ACCOUNT_ID: "r2aid",
    R2_ACCESS_KEY_ID: "r2key",
    R2_SECRET_ACCESS_KEY: "r2secret",
    R2_BUCKET_PRIVATE: "priv",
    R2_BUCKET_PUBLIC: "pub",
    NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL: IMAGE_CDN,
    RESEND_API_KEY: "resend",
    RESEND_FROM_EMAIL: "no-reply@ceylonsafety.com",
    PAYHERE_MERCHANT_ID: "mid",
    PAYHERE_MERCHANT_SECRET: "msecret",
    UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "tok",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "tskey",
    TURNSTILE_SECRET_KEY: "tssecret",
    CRON_SECRET: "cronsecret",
    NEXT_PUBLIC_APP_URL: APP_URL,
    CSP_MODE: "report-only",
    ...extra,
  };
}

describe("buildPublicCsp (AC1, AC3)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = makeEnv() as unknown as NodeJS.ProcessEnv;
  });

  it("includes own host", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain("'self'");
  });

  it("includes image CDN in img-src", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain(IMAGE_CDN);
  });

  it("includes Google avatar host in img-src", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain("lh3.googleusercontent.com");
  });

  it("includes Supabase URL in connect-src", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain(SUPABASE_URL);
  });

  it("includes YouTube no-cookie in frame-src", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain("https://www.youtube-nocookie.com");
  });

  it("includes Turnstile host for comment form", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain("challenges.cloudflare.com");
  });

  it("has frame-ancestors none", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("does not allow data: URIs globally in img-src", async () => {
    const { buildPublicCsp } = await import("../headers");
    const csp = buildPublicCsp();
    // data: is only allowed on /admin/security via private policy
    const imgSrcMatch = csp.match(/img-src([^;]*)/);
    expect(imgSrcMatch?.[1]).not.toContain("data:");
  });
});

describe("buildPrivateCsp (AC2, AC3, EC2)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = makeEnv() as unknown as NodeJS.ProcessEnv;
  });

  it("excludes ad and analytics hosts", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/profile");
    expect(csp).not.toContain("googlesyndication");
    expect(csp).not.toContain("googletagmanager");
  });

  it("includes Turnstile host on sign-in", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/sign-in");
    expect(csp).toContain("challenges.cloudflare.com");
  });

  it("includes Turnstile host on sign-up", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/sign-up");
    expect(csp).toContain("challenges.cloudflare.com");
  });

  it("excludes Turnstile host on non-widget private path", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/profile");
    expect(csp).not.toContain("challenges.cloudflare.com");
  });

  it("includes PayHere in form-action on /checkout path", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/checkout/pay");
    expect(csp).toContain("form-action");
    expect(csp).toContain("payhere");
  });

  it("excludes PayHere form-action on non-checkout private path", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/profile");
    const formActionMatch = csp.match(/form-action([^;]*)/);
    expect(formActionMatch?.[1]).not.toContain("payhere");
  });

  it("allows data: img-src on /admin/security (EC2)", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/admin/security");
    const imgSrcMatch = csp.match(/img-src([^;]*)/);
    expect(imgSrcMatch?.[1]).toContain("data:");
  });

  it("does not allow data: img-src on other admin paths", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/admin/dashboard");
    const imgSrcMatch = csp.match(/img-src([^;]*)/);
    expect(imgSrcMatch?.[1]).not.toContain("data:");
  });

  it("has frame-ancestors none", async () => {
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/profile");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("PayHere URL derivation (EC sandbox vs production)", () => {
  it("uses sandbox URL when sandbox flag is true", async () => {
    vi.resetModules();
    process.env = makeEnv({ NEXT_PUBLIC_PAYHERE_SANDBOX: "true" }) as unknown as NodeJS.ProcessEnv;
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/checkout/pay");
    expect(csp).toContain("sandbox.payhere.lk");
  });

  it("uses production URL when sandbox flag is false", async () => {
    vi.resetModules();
    process.env = makeEnv({ NEXT_PUBLIC_PAYHERE_SANDBOX: "false" }) as unknown as NodeJS.ProcessEnv;
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/checkout/pay");
    expect(csp).toContain("www.payhere.lk");
    expect(csp).not.toContain("sandbox.payhere.lk");
  });
});

describe("CSP mode config (AC5, EC4)", () => {
  it("throws at startup when CSP_MODE is missing (EC4)", async () => {
    vi.resetModules();
    const env = makeEnv();
    delete (env as Record<string, string>)["CSP_MODE"];
    process.env = env as unknown as NodeJS.ProcessEnv;
    await expect(import("@/lib/config")).rejects.toThrow("CSP_MODE");
  });

  it("throws at startup when CSP_MODE is invalid", async () => {
    vi.resetModules();
    process.env = makeEnv({ CSP_MODE: "block" }) as unknown as NodeJS.ProcessEnv;
    await expect(import("@/lib/config")).rejects.toThrow("CSP_MODE");
  });

  it("accepts report-only mode", async () => {
    vi.resetModules();
    process.env = makeEnv({ CSP_MODE: "report-only" }) as unknown as NodeJS.ProcessEnv;
    const { config } = await import("@/lib/config");
    expect(config.csp.mode).toBe("report-only");
  });

  it("accepts enforce mode", async () => {
    vi.resetModules();
    process.env = makeEnv({ CSP_MODE: "enforce" }) as unknown as NodeJS.ProcessEnv;
    const { config } = await import("@/lib/config");
    expect(config.csp.mode).toBe("enforce");
  });
});

describe("buildCspHeaderName (AC5)", () => {
  it("returns Content-Security-Policy-Report-Only in report-only mode", async () => {
    vi.resetModules();
    process.env = makeEnv({ CSP_MODE: "report-only" }) as unknown as NodeJS.ProcessEnv;
    const { cspHeaderName } = await import("../headers");
    expect(cspHeaderName()).toBe("Content-Security-Policy-Report-Only");
  });

  it("returns Content-Security-Policy in enforce mode", async () => {
    vi.resetModules();
    process.env = makeEnv({ CSP_MODE: "enforce" }) as unknown as NodeJS.ProcessEnv;
    const { cspHeaderName } = await import("../headers");
    expect(cspHeaderName()).toBe("Content-Security-Policy");
  });
});

describe("buildStaticHeaders (AC4)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = makeEnv() as unknown as NodeJS.ProcessEnv;
  });

  const privatePaths = [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/suspended",
    "/admin/dashboard",
    "/cart",
    "/checkout/pay",
    "/download/abc",
    "/purchases",
    "/profile",
    "/api/health",
  ];

  for (const path of privatePaths) {
    it(`sends no-store and noindex on ${path}`, async () => {
      const { buildStaticHeaders } = await import("../headers");
      const headers = buildStaticHeaders(path);
      const cacheControl = headers.find((h) => h.key === "Cache-Control");
      const robots = headers.find((h) => h.key === "X-Robots-Tag");
      expect(cacheControl?.value).toBe("no-store");
      expect(robots?.value).toContain("noindex");
    });
  }

  it("does not send no-store on public path", async () => {
    const { buildStaticHeaders } = await import("../headers");
    const headers = buildStaticHeaders("/articles/some-slug");
    const cacheControl = headers.find((h) => h.key === "Cache-Control");
    expect(cacheControl).toBeUndefined();
  });

  it("sends same-origin referrer policy on private path (AC4)", async () => {
    const { buildStaticHeaders } = await import("../headers");
    const headers = buildStaticHeaders("/profile");
    const ref = headers.find((h) => h.key === "Referrer-Policy");
    expect(ref?.value).toBe("same-origin");
  });
});

describe("EC1 — host list extensibility", () => {
  it("public CSP does not contain ad hosts on private paths", async () => {
    vi.resetModules();
    process.env = makeEnv() as unknown as NodeJS.ProcessEnv;
    const { buildPrivateCsp } = await import("../headers");
    const csp = buildPrivateCsp("/admin/dashboard");
    expect(csp).not.toContain("googlesyndication");
  });
});
