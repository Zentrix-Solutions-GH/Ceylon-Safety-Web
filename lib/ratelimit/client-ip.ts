import { CF_IPV4_RANGES, CF_IPV6_RANGES } from "./cloudflare-ranges";

// ---------------------------------------------------------------------------
// IPv4 helpers
// ---------------------------------------------------------------------------

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function parseCidrV4(cidr: string): { base: number; mask: number } {
  const [ip, bits] = cidr.split("/");
  const prefix = parseInt(bits, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { base: ipv4ToInt(ip) & mask, mask };
}

function isInCidrV4(ip: string, cidr: string): boolean {
  try {
    const { base, mask } = parseCidrV4(cidr);
    return (ipv4ToInt(ip) & mask) === base;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IPv6 helpers — ES2017-compatible (no BigInt)
// ---------------------------------------------------------------------------

// Expand an IPv6 address into 8 groups of 16-bit numbers
function expandIPv6(ip: string): number[] | null {
  try {
    const bare = ip.split("%")[0]; // strip zone id
    const sides = bare.split("::");
    if (sides.length > 2) return null;
    const left = sides[0] ? sides[0].split(":") : [];
    const right = sides.length === 2 && sides[1] ? sides[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    const groups = [
      ...left,
      ...Array(missing).fill("0"),
      ...right,
    ];
    if (groups.length !== 8) return null;
    return groups.map((g) => parseInt(g || "0", 16));
  } catch {
    return null;
  }
}

function isInCidrV6(ip: string, cidr: string): boolean {
  try {
    const [net, bits] = cidr.split("/");
    const prefix = parseInt(bits, 10);
    const addr = expandIPv6(ip);
    const base = expandIPv6(net);
    if (!addr || !base) return false;

    let remaining = prefix;
    for (let i = 0; i < 8; i++) {
      if (remaining <= 0) break;
      const groupBits = Math.min(remaining, 16);
      const shift = 16 - groupBits;
      const mask = groupBits === 16 ? 0xffff : ((0xffff >> shift) << shift) & 0xffff;
      if ((addr[i] & mask) !== (base[i] & mask)) return false;
      remaining -= groupBits;
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main helper
// ---------------------------------------------------------------------------

function isCloudflareIp(ip: string): boolean {
  if (ip.includes(":")) {
    return CF_IPV6_RANGES.some((r) => isInCidrV6(ip, r));
  }
  return CF_IPV4_RANGES.some((r) => isInCidrV4(ip, r));
}

/**
 * Returns the real client IP.
 * CF-Connecting-IP is trusted only when remoteAddress is inside a Cloudflare range.
 * A header set by the browser is never trusted on its own.
 */
export function getClientIp(
  headers: Headers,
  remoteAddress: string | undefined
): string | undefined {
  if (!remoteAddress) return undefined;
  if (isCloudflareIp(remoteAddress)) {
    const cfIp = headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  }
  return remoteAddress;
}
