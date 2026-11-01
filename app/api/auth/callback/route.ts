import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNextCookie, clearNextCookie } from "@/lib/auth/cookies";
import { safeNext } from "@/lib/auth/redirect";

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
  // On a second call with the same code Supabase will return an error; we still
  // redirect the user safely rather than crashing (EC2).
  await supabase.auth.exchangeCodeForSession(code);

  // Read and clear the return-address cookie set by startGoogleSignIn (AC5).
  const rawNext = await getNextCookie();
  await clearNextCookie();

  const redirectTo = safeNext(rawNext);
  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 307 });
}
