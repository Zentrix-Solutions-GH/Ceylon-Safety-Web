'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { updateProfileSchema } from "@/lib/validation/user";
import type { UpdateProfileInput, UpdateProfileResult } from "@/types/user";
import type { TablesUpdate } from "@/types/database";

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    const field = firstError?.path.join(".") ?? "unknown";
    return { ok: false, code: "validation_failed", field };
  }
  const data = parsed.data;

  // AC8: require active (non-suspended) account via shared helper
  const authResult = await requireActiveAccount();
  if (!authResult.ok) {
    return { ok: false, code: "not_allowed" };
  }
  const userId = authResult.user.id;

  const supabase = await createSupabaseServerClient();

  // Map camelCase input to snake_case DB columns.
  // AC3: email is never included — not self-service in v1.
  const updatePayload: TablesUpdate<"profiles"> = {};
  if (data.firstName !== undefined) updatePayload.first_name = data.firstName;
  if (data.lastName !== undefined) updatePayload.last_name = data.lastName;
  if (data.displayName !== undefined) updatePayload.display_name = data.displayName;
  if (data.phone !== undefined) updatePayload.phone = data.phone || null;
  if (data.companyName !== undefined) updatePayload.company_name = data.companyName || null;
  if (data.taxId !== undefined) updatePayload.tax_id = data.taxId || null;
  if ("billingAddress" in data) updatePayload.billing_address = data.billingAddress ?? null;

  if (Object.keys(updatePayload).length === 0) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("id")
    .single();

  if (error) {
    return { ok: false, code: "unknown" };
  }

  return { ok: true };
}
