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
  let exchangeError = false;
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Supabase returned an error (e.g. code already used, token expired).
      // Do NOT clear auth_next so the user can retry the Google flow.
      exchangeError = true;
    }
  } catch {
    // Supabase unreachable or malformed response.
    exchangeError = true;
  }

  if (exchangeError) {
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url), { status: 307 });
  }

  // Send welcome email once (auth design §14, §19); failure must not break sign-in.
  try {
    const supabase2 = await createSupabaseServerClient();
    const { data: { user } } = await supabase2.auth.getUser();
    if (user?.id && user?.email) {
      sendWelcomeEmail(user.email, user.id).catch(() => undefined);
    }
  } catch {
    // Never break redirect on welcome email errors
  }

  // Read and clear the return-address cookie set by startGoogleSignIn (AC5).
  const rawNext = await getNextCookie();
  await clearNextCookie();

  const redirectTo = safeNext(rawNext);
  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 307 });
}
