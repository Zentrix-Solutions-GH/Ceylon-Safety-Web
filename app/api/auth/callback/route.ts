import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNextCookie, clearNextCookie } from "@/lib/auth/cookies";
import { safeNext } from "@/lib/auth/redirect";
import { sendWelcomeEmail } from "@/lib/resend/client";

// Auth design §5.2: exchanges the one-time code Supabase sends back,
// reads + clears the auth_next cookie, and redirects through safeNext.
// This route is exempt from the middleware's coarse per-IP rate limit (§8 step 2).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url), { status: 307 });
  }

  const supabase = await createSupabaseServerClient();

  // Exchange the one-time code for a session (PKCE flow).
  // Network errors are caught so the handler always redirects rather than throws.
  let sessionUser: { id: string; email?: string } | null = null;
  let exchangeError = false;
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Supabase returned an error (e.g. code already used, token expired).
      // Do NOT clear auth_next so the user can retry the Google flow.
      exchangeError = true;
    } else {
      // Session is already in memory after the exchange — no extra RPC needed.
      sessionUser = data.session?.user ?? null;
    }
  } catch {
    // Supabase unreachable or malformed response.
    exchangeError = true;
  }

  if (exchangeError) {
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url), { status: 307 });
  }

  // Send welcome email once (auth design §14, §19); failure must not break sign-in.
  if (sessionUser?.id && sessionUser.email) {
    sendWelcomeEmail(sessionUser.email, sessionUser.id).catch((err: unknown) => {
      const name = err instanceof Error ? err.constructor.name : "UnknownError";
      console.error("[welcome-email] callback send failed:", name);
    });
  }

  // Read and clear the return-address cookie set by startGoogleSignIn (AC5).
  const rawNext = await getNextCookie();
  await clearNextCookie();

  const redirectTo = safeNext(rawNext);
  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 307 });
}
