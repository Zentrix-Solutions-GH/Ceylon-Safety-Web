import type { NextConfig } from "next";
import {
  buildPublicCsp,
  buildPrivateCsp,
  buildStaticHeaders,
  cspHeaderName,
} from "@/lib/security/headers";

// Scope cut (S-030): per-path CSP overrides (PayHere form-action on /checkout,
// Turnstile on auth pages, data: on /admin/security) are applied by middleware
// in S-033. next.config.ts provides the strictest baseline private policy
// (/profile sentinel) which is safe in report-only mode. Do NOT switch
// CSP_MODE to enforce until S-033 is live — see story Out of scope.
const PRIVATE_SENTINEL = "/profile";

const PRIVATE_SOURCE =
  "/(sign-in|sign-up|forgot-password|reset-password|verify-email|suspended|admin|cart|checkout|download|purchases|profile|api)(.*)";

const PUBLIC_SOURCE =
  "/((?!sign-in|sign-up|forgot-password|reset-password|verify-email|suspended|admin|cart|checkout|download|purchases|profile|api).*)";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // R2 public bucket and YouTube thumbnails added during S-001 infra setup
    ],
  },
  async headers() {
    const headerName = cspHeaderName();
    const privateStaticHeaders = buildStaticHeaders(PRIVATE_SENTINEL);

    return [
      // Public pages — host-list CSP, no nonces, static-friendly
      {
        source: PUBLIC_SOURCE,
        headers: [
          { key: headerName, value: buildPublicCsp() },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      // Private pages — strictest baseline CSP + no-store + noindex
      // Per-path overrides (PayHere, Turnstile, data:) are applied by S-033 middleware.
      {
        source: PRIVATE_SOURCE,
        headers: [
          { key: headerName, value: buildPrivateCsp(PRIVATE_SENTINEL) },
          { key: "X-Frame-Options", value: "DENY" },
          ...privateStaticHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
