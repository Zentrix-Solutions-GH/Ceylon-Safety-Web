'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startGoogleSignInSchema } from "@/lib/validation/auth";
import { setNextCookie } from "@/lib/auth/cookies";
import { publicConfig } from "@/lib/config";
import type { StartGoogleSignInInput, StartGoogleSignInResult } from "@/types/auth";

export async function startGoogleSignIn(
  input: StartGoogleSignInInput
): Promise<StartGoogleSignInResult> {
  const parsed = startGoogleSignInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "unknown" };
  }
  const { next } = parsed.data;

  // Store the return address before leaving the site (auth design §5.2 step 1).
  // SameSite=Lax so the cookie survives the redirect back from Google.
  if (next) {
    await setNextCookie(next);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicConfig.appUrl}/api/auth/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return { ok: false, code: "unknown" };
  }

  return { ok: true, url: data.url };
}
