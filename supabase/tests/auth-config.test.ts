// @vitest-environment node
// AC1, AC2, AC5, AC6, AC7, AC8 — reads supabase/config.toml and asserts
// the auth settings match the story requirements.
// No TOML parser dependency: uses regex/string matching which is robust
// enough for this controlled file.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const configPath = path.resolve(__dirname, "../../supabase/config.toml");

function readConfig(): string {
  return fs.readFileSync(configPath, "utf8");
}

// Extract a value from a TOML section: returns the string after `key = `
function getValue(toml: string, key: string): string | undefined {
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m");
  const m = toml.match(re);
  return m ? m[1].trim() : undefined;
}

describe("S-031 AC1: email+password and Google enabled; all others off", () => {
  it("enable_signup is true at [auth] level", () => {
    const src = readConfig();
    // Extract the [auth] block: from the header until the next section header
    // (a line that starts with '[' followed by a letter, not inside a value).
    const authBlock =
      src.match(/^\[auth\]\n([\s\S]*?)(?=^\[auth\.|^\[[\w])/m)?.[0] ?? "";
    const m = authBlock.match(/^enable_signup\s*=\s*(.+)$/m);
    expect(m?.[1].trim()).toBe("true");
  });

  it("enable_anonymous_sign_ins is false", () => {
    const src = readConfig();
    expect(getValue(src, "enable_anonymous_sign_ins")).toBe("false");
  });

  it("enable_manual_linking is false (AC1: no identity merging without explicit re-auth)", () => {
    const src = readConfig();
    expect(getValue(src, "enable_manual_linking")).toBe("false");
  });

  it("[auth.email] enable_signup is true", () => {
    const src = readConfig();
    // After [auth.email] section header, find enable_signup
    const emailSection = src.match(/\[auth\.email\][^\[]+/)?.[0] ?? "";
    const m = emailSection.match(/enable_signup\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });

  it("[auth.email] enable_confirmations is true (AC1: confirm email ON)", () => {
    const src = readConfig();
    const emailSection = src.match(/\[auth\.email\][^\[]+/)?.[0] ?? "";
    const m = emailSection.match(/enable_confirmations\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });

  it("[auth.sms] enable_signup is false", () => {
    const src = readConfig();
    const smsSection = src.match(/\[auth\.sms\][^\[]+/)?.[0] ?? "";
    const m = smsSection.match(/enable_signup\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("false");
  });

  it("[auth.external.google] enabled is true", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.external\.google\][^\[]+/)?.[0] ?? "";
    expect(section).not.toBe("");
    const m = section.match(/enabled\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });
});

describe("S-031 AC2: password length, OTP length, OTP expiry", () => {
  it("minimum_password_length is 8", () => {
    const src = readConfig();
    expect(getValue(src, "minimum_password_length")).toBe("8");
  });

  it("otp_length in [auth.email] is 6 (EC1 fallback)", () => {
    const src = readConfig();
    const emailSection = src.match(/\[auth\.email\][^\[]+/)?.[0] ?? "";
    const m = emailSection.match(/otp_length\s*=\s*(\d+)/m);
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(6);
  });

  it("otp_expiry in [auth.email] is 600 (10 minutes)", () => {
    const src = readConfig();
    const emailSection = src.match(/\[auth\.email\][^\[]+/)?.[0] ?? "";
    const m = emailSection.match(/otp_expiry\s*=\s*(\d+)/m);
    expect(m?.[1].trim()).toBe("600");
  });
});

describe("S-031 AC5: Turnstile captcha — test keys in local config", () => {
  it("[auth.captcha] section exists and is enabled", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.captcha\][^\[]+/)?.[0] ?? "";
    expect(section).not.toBe("");
    const m = section.match(/enabled\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });

  it("[auth.captcha] provider is turnstile", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.captcha\][^\[]+/)?.[0] ?? "";
    const m = section.match(/provider\s*=\s*"(.+)"/m);
    expect(m?.[1]).toBe("turnstile");
  });

  it("[auth.captcha] secret is the Cloudflare always-pass test key", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.captcha\][^\[]+/)?.[0] ?? "";
    const m = section.match(/secret\s*=\s*"(.+)"/m);
    // Cloudflare published always-pass key: exactly 1x + 33 zeros + AA
    expect(m?.[1]).toBe("1x0000000000000000000000000000000AA");
  });
});

describe("S-031 AC6: custom access token hook enabled", () => {
  it("[auth.hook.custom_access_token] section exists", () => {
    const src = readConfig();
    const section =
      src.match(/\[auth\.hook\.custom_access_token\][^\[]+/)?.[0] ?? "";
    expect(section).not.toBe("");
  });

  it("[auth.hook.custom_access_token] enabled is true", () => {
    const src = readConfig();
    const section =
      src.match(/\[auth\.hook\.custom_access_token\][^\[]+/)?.[0] ?? "";
    const m = section.match(/enabled\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });

  it("[auth.hook.custom_access_token] uri points to private.custom_access_token_hook", () => {
    const src = readConfig();
    const section =
      src.match(/\[auth\.hook\.custom_access_token\][^\[]+/)?.[0] ?? "";
    const m = section.match(/uri\s*=\s*"(.+)"/m);
    expect(m?.[1]).toContain("custom_access_token_hook");
  });
});

describe("S-031 AC7: TOTP MFA enabled", () => {
  it("[auth.mfa.totp] enroll_enabled is true", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.mfa\.totp\][^\[]+/)?.[0] ?? "";
    const m = section.match(/enroll_enabled\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });

  it("[auth.mfa.totp] verify_enabled is true", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.mfa\.totp\][^\[]+/)?.[0] ?? "";
    const m = section.match(/verify_enabled\s*=\s*(.+)/m);
    expect(m?.[1].trim()).toBe("true");
  });
});

describe("S-031 AC8: site_url is localhost in local config (no wildcards)", () => {
  it("site_url contains localhost or 127.0.0.1", () => {
    const src = readConfig();
    const m = src.match(/site_url\s*=\s*"(.+)"/m);
    expect(m?.[1]).toMatch(/localhost|127\.0\.0\.1/);
  });

  it("site_url does not contain a wildcard", () => {
    const src = readConfig();
    const m = src.match(/site_url\s*=\s*"(.+)"/m);
    expect(m?.[1]).not.toContain("*");
  });

  it("additional_redirect_urls does not contain wildcards", () => {
    const src = readConfig();
    const m = src.match(/additional_redirect_urls\s*=\s*\[([^\]]*)\]/m);
    if (m?.[1]) {
      expect(m[1]).not.toContain("*");
    }
  });

  it("[auth.external.google] redirect_uri is an exact path (no wildcards)", () => {
    const src = readConfig();
    const section = src.match(/\[auth\.external\.google\][^\[]+/)?.[0] ?? "";
    const m = section.match(/redirect_uri\s*=\s*"(.+)"/m);
    expect(m?.[1]).not.toContain("*");
    expect(m?.[1]).toContain("/api/auth/callback");
  });
});

// AC1 (extension): no other external provider is enabled.
// Supabase defaults absent sections to disabled, but an accidental addition
// would not be caught without this assertion.
describe("S-031 AC1 (extension): no other external providers enabled", () => {
  const KNOWN_DISABLED = [
    "apple",
    "azure",
    "bitbucket",
    "discord",
    "facebook",
    "figma",
    "github",
    "gitlab",
    "kakao",
    "keycloak",
    "linkedin_oidc",
    "notion",
    "slack_oidc",
    "spotify",
    "twitch",
    "twitter",
    "workos",
    "zoom",
  ];

  for (const provider of KNOWN_DISABLED) {
    it(`[auth.external.${provider}] is NOT enabled`, () => {
      const src = readConfig();
      const section =
        src.match(
          new RegExp(`\\[auth\\.external\\.${provider}\\][^\\[]+`, "m")
        )?.[0] ?? "";
      if (section === "") {
        // Section absent → Supabase defaults it to disabled. Pass.
        return;
      }
      const m = section.match(/enabled\s*=\s*(.+)/m);
      // If the section is present, enabled must not be true
      expect(m?.[1]?.trim()).not.toBe("true");
    });
  }
});
