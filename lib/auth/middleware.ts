import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ratelimit/client-ip";
import type { UserRole, AccountStatus } from "@/types/auth";

// ── Private response headers (AC6) ───────────────────────────────────────────

const PRIVATE_HEADERS: [string, string][] = [
  ["Cache-Control", "no-store"],
  ["X-Robots-Tag", "noindex, nofollow"],
];

function applyPrivateHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of PRIVATE_HEADERS) {
    res.headers.set(key, value);
  }
  return res;
}

// ── Rate-limit exemptions (AC2) ───────────────────────────────────────────────

const RATE_LIMIT_EXEMPT = new Set([
  "/api/payhere/notify",
  "/api/auth/callback",
]);

function isRateLimitExempt(pathname: string): boolean {
  if (RATE_LIMIT_EXEMPT.has(pathname)) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  return false;
}


// Copy Set-Cookie headers from a NextResponse.next() onto a redirect response
// so that auth cookie clearing (written by supabase.auth.signOut via the setAll
// callback) reaches the browser even though signOut runs before we decide to
// return a different NextResponse object.
function forwardCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value, cookie);
  }
  return to;
}

// ── Route classification ───────────────────────────────────────────────────────

const GUEST_ONLY_PATHS = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/verify-email",
]);

// /admin/security and /admin/mfa require staff claim but NOT TOTP (EC4)
const ADMIN_NO_MFA_PATHS = new Set(["/admin/security", "/admin/mfa"]);

function isCustomerPath(pathname: string): boolean {
  if (pathname === "/cart") return true;
  return (
    pathname.startsWith("/checkout/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/purchases/") ||
    pathname === "/purchases" ||
    pathname.startsWith("/profile/") ||
    pathname === "/profile" ||
    pathname.startsWith("/download/") ||
    pathname === "/download"
  );
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isSystemPath(pathname: string): boolean {
  return pathname === "/admin/system" || pathname.startsWith("/admin/system/");
}

function hasStaffAccess(role: UserRole | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

// ── next cookie (AC4) ─────────────────────────────────────────────────────────

function setNextCookie(res: NextResponse, req: NextRequest): void {
  const nextUrl = req.nextUrl.pathname;
  res.cookies.set("next", nextUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes — short-lived per auth design §4
    path: "/",
  });
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── Step 2: Coarse rate limit for /api/* (AC2, AC7) ──────────────────────────
  if (pathname.startsWith("/api/")) {
    if (!isRateLimitExempt(pathname)) {
      // NextRequest in Next.js 15 does not expose the socket-level remote address.
      // Without it, CF-Connecting-IP cannot be verified against CF ranges.
      // Passing undefined makes getClientIp return undefined, falling back to "unknown".
      // S-002 hosting test will determine the correct header; until then this is best-effort.
      const ip = getClientIp(req.headers, undefined) ?? "unknown";
      const rl = await checkRateLimit({
        limitName: "api_coarse",
        key: ip,
        maxCount: 60,
        windowSeconds: 60,
        mode: "open",
      });
      if (!rl.ok) {
        return new NextResponse(null, {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }
    // API routes authenticate their own callers (AC7) — pass through without headers
    return NextResponse.next();
  }

  // ── Step 3: Verify/refresh session for page routes only (AC7) ────────────────
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const claimedRole = user?.app_metadata?.["user_role"] as UserRole | undefined;
  const claimedStatus = user?.app_metadata?.["account_status"] as AccountStatus | undefined;
  const isSignedIn = !!user;

  // ── Step 4: Route class rules ─────────────────────────────────────────────────

  // Guest-only paths (AC3)
  if (GUEST_ONLY_PATHS.has(pathname)) {
    if (isSignedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return applyPrivateHeaders(response);
  }

  // /reset-password — not guest-only (AC3)
  if (pathname === "/reset-password") {
    return applyPrivateHeaders(response);
  }

  // Customer paths (AC4)
  if (isCustomerPath(pathname)) {
    if (!isSignedIn) {
      const res = NextResponse.redirect(new URL("/sign-in", req.url));
      setNextCookie(res, req);
      return applyPrivateHeaders(res);
    }
    if (claimedStatus === "suspended") {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[middleware] signOut failed:", error.message);
      const redirect = applyPrivateHeaders(
        NextResponse.redirect(new URL("/suspended", req.url))
      );
      return forwardCookies(response, redirect);
    }
    return applyPrivateHeaders(response);
  }

  // Admin paths (AC5)
  if (isAdminPath(pathname)) {
    if (!isSignedIn) {
      const res = NextResponse.redirect(new URL("/sign-in", req.url));
      setNextCookie(res, req);
      return applyPrivateHeaders(res);
    }

    // Suspended → sign out unconditionally regardless of role (P1 fix: covers editor)
    if (claimedStatus === "suspended") {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[middleware] signOut failed:", error.message);
      const redirect = applyPrivateHeaders(
        NextResponse.redirect(new URL("/suspended", req.url))
      );
      return forwardCookies(response, redirect);
    }

    // No staff claim → not found (do not reveal the admin area exists, REQ-150)
    if (!hasStaffAccess(claimedRole)) {
      return new NextResponse(null, { status: 404 });
    }

    // /admin/system/** — super_admin only (AC5)
    if (isSystemPath(pathname) && claimedRole !== "super_admin") {
      return new NextResponse(null, { status: 404 });
    }

    // /admin/security and /admin/mfa — staff claim only, no TOTP check (EC4)
    if (ADMIN_NO_MFA_PATHS.has(pathname)) {
      return applyPrivateHeaders(response);
    }

    // All other admin pages — check TOTP enrollment and authenticator assurance level
    // user.factors comes from the JWT and can be up to ~1 hr stale. It is used
    // only as a fast pre-check to route the user to /admin/security. The
    // authoritative real-time guard is getAuthenticatorAssuranceLevel() below.
    const hasTotpEnrolled = user.factors?.some(
      (f) => f.factor_type === "totp" && f.status === "verified"
    ) ?? false;

    if (!hasTotpEnrolled) {
      return applyPrivateHeaders(
        NextResponse.redirect(new URL("/admin/security", req.url))
      );
    }

    // getAuthenticatorAssuranceLevel() is the correct API — user.amr is not
    // present on the object returned by getUser() (it is a JWT-only field).
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const hasAuthenticatorLevel = aal?.currentLevel === "aal2";

    if (!hasAuthenticatorLevel) {
      return applyPrivateHeaders(
        NextResponse.redirect(new URL("/admin/mfa", req.url))
      );
    }

    return applyPrivateHeaders(response);
  }

  // Any remaining matched path (e.g. /download without a sub-path edge case)
  return applyPrivateHeaders(response);
}
