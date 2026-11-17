import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SB = SupabaseClient<Database>;

const DEFAULT_DOWNLOAD_LIMIT_KEY = "default_download_limit";
const DEFAULT_DOWNLOAD_LIMIT_FALLBACK = 3;

export async function fetchApprovalDownloadLimit(sb: SB): Promise<number> {
  const { data } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", DEFAULT_DOWNLOAD_LIMIT_KEY)
    .single();
  if (data?.value && typeof data.value === "number") return data.value;
  return DEFAULT_DOWNLOAD_LIMIT_FALLBACK;
}

/**
 * Returns true when the acting staff member is the buyer (AC4, S3).
 * Compares userId, email (case-insensitive), and phone.
 * Known limit EC3: a staff member with a different customer email/phone can bypass.
 */
export function isSelfApproval(
  order: { user_id: string },
  buyer: { email: string | null; phone: string | null } | null,
  actor: { id: string; email: string | null; phone: string | null }
): boolean {
  if (order.user_id === actor.id) return true;
  if (!buyer) return false;
  if (
    buyer.email &&
    actor.email &&
    buyer.email.toLowerCase() === actor.email.toLowerCase()
  )
    return true;
  if (buyer.phone && actor.phone && buyer.phone === actor.phone) return true;
  return false;
}
