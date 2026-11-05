import "server-only";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RefKind } from "@/lib/content/schema";

type CountResult =
  | { ok: true; count: number }
  | { ok: false; code: "not_allowed" | "unknown" };

/**
 * Count how many live (non-deleted) articles reference an item of the given kind.
 * Used for "Used in N articles" warnings in admin screens.
 */
export async function countArticleRefs(kind: RefKind, id: string): Promise<CountResult> {
  const auth = await requireStaff("articles.*");
  if (!auth.ok) {
    return { ok: false, code: "not_allowed" };
  }

  const supabase = createSupabaseServiceRoleClient();

  // Join via articles to exclude soft-deleted articles (AC11)
  const { count, error } = await supabase
    .from("article_refs")
    .select("id, articles!inner(deleted_at)", { count: "exact", head: true })
    .eq("ref_type", kind)
    .eq("ref_id", id)
    .is("articles.deleted_at", null);

  if (error) {
    return { ok: false, code: "unknown" };
  }

  return { ok: true, count: count ?? 0 };
}
