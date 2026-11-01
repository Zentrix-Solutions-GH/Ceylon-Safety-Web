import { describe, it, expect } from "vitest";
import { getClientIp } from "../lib/ratelimit/client-ip";

// Cloudflare IPv4 and IPv6 ranges are defined in cloudflare-ranges.ts
// These tests use known Cloudflare addresses from the published list.

const CF_IPV4 = "103.21.244.5"; // inside 103.21.244.0/22
const CF_IPV6 = "2400:cb00::1"; // inside 2400:cb00::/32
const NON_CF_PRIVATE = "192.168.1.100";

function headers(cf?: string, forwarded?: string): Headers {
  const h = new Headers();
  if (cf) h.set("cf-connecting-ip", cf);
  if (forwarded) h.set("x-forwarded-for", forwarded);
  return h;
}

// ---------------------------------------------------------------------------
// AC5 — CF header trusted only from CF ranges
// ---------------------------------------------------------------------------

describe("AC5: getClientIp", () => {
  it("returns CF-Connecting-IP when remoteAddress is a known CF range", () => {
    const ip = getClientIp(headers("10.10.10.10", "evil"), CF_IPV4);
    expect(ip).toBe("10.10.10.10");
  });

  it("returns remoteAddress when remoteAddress is NOT in CF ranges", () => {
    const ip = getClientIp(headers("faked-by-browser"), NON_CF_PRIVATE);
    expect(ip).toBe(NON_CF_PRIVATE);
  });

  it("ignores X-Forwarded-For when remoteAddress is not CF", () => {
    const ip = getClientIp(headers(undefined, "9.9.9.9"), NON_CF_PRIVATE);
    expect(ip).toBe(NON_CF_PRIVATE);
  });

  it("returns CF-Connecting-IP for an IPv6 CF remoteAddress", () => {
    const ip = getClientIp(headers("2001:db8::1"), CF_IPV6);
    expect(ip).toBe("2001:db8::1");
  });

  it("returns the CF-Connecting-IP for another IPv4 CF range (173.245.48.0/20)", () => {
    const cfIp = "173.245.48.100";
    const ip = getClientIp(headers("client-ip"), cfIp);
    expect(ip).toBe("client-ip");
  });
});

// ---------------------------------------------------------------------------
// EC2 — remoteAddress missing
// ---------------------------------------------------------------------------

describe("EC2: remoteAddress missing", () => {
  it("returns undefined when remoteAddress is undefined", () => {
    const ip = getClientIp(headers("cf-ip"), undefined);
    expect(ip).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EC3 — IPv6 remoteAddress
// ---------------------------------------------------------------------------

describe("EC3: IPv6 handling", () => {
  it("matches IPv6 Cloudflare ranges", () => {
    const ip = getClientIp(headers("::1"), CF_IPV6);
    expect(ip).toBe("::1");
  });

  it("rejects spoofed IPv6 CF header when remoteAddress is not CF", () => {
    const ip = getClientIp(headers("2400:cb00::1"), "2001:db8::dead");
    expect(ip).toBe("2001:db8::dead");
  });
});
