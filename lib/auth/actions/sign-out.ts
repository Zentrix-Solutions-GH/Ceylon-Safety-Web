'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutSchema } from "@/lib/validation/auth";
import type { SignOutInput, SignOutResult } from "@/types/auth";

export async function signOut(input: SignOutInput): Promise<SignOutResult> {
  const parsed = signOutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "unknown" };
  }
  const supabase = await createSupabaseServerClient();
  const scope = parsed.data.scope === "all" ? "global" : "local";
  const { error } = await supabase.auth.signOut({ scope });
  if (error) {
    return { ok: false, code: "unknown" };
  }
  return { ok: true };
}
