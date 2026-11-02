import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "pending_signup";
// 15 minutes — auth design §19
const MAX_AGE = 60 * 15;

interface PendingSignup {
  email: string;
  next?: string;
}

export async function setPendingSignup(data: PendingSignup): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getPendingSignup(): Promise<PendingSignup | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).email !== "string"
    ) {
      return null;
    }
    return parsed as PendingSignup;
  } catch {
    return null;
  }
}

export async function clearPendingSignup(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// ─── Google sign-in "next" cookie (S-035, auth design §5.2) ──────────────────

const NEXT_COOKIE_NAME = "auth_next";
// 15 minutes — long enough for the OAuth round-trip; auth design §5.2 + §19
const NEXT_MAX_AGE = 60 * 15;

export async function setNextCookie(next: string): Promise<void> {
  const jar = await cookies();
  jar.set(NEXT_COOKIE_NAME, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: NEXT_MAX_AGE,
    path: "/",
  });
}

export async function getNextCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(NEXT_COOKIE_NAME)?.value ?? null;
}

export async function clearNextCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(NEXT_COOKIE_NAME);
}
