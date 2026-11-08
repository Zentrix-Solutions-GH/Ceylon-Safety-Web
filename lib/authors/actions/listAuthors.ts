import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { unstable_noStore as noStore } from "next/cache";
import type { Author, ListAuthorsInput, ListAuthorsResult } from "@/types/author";
import { ANON_ACTOR } from "@/lib/engagement/actions/constants";

function mapRow(row: Record<string, unknown>): Author {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    bio: (row.bio as string | null) ?? null,
    isActive: row.is_active as boolean,
    updatedAt: row.updated_at as string,
  };
}

export async function listAuthors(input: ListAuthorsInput): Promise<ListAuthorsResult> {
  noStore();

  const auth = await requireStaff("authors.*");
  if (!auth.ok) {
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "author",
        entityId: "",
        after: { permission: "authors.*" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const supabase = createSupabaseServiceRoleClient();
  let query = supabase.from("authors").select("id, name, slug, bio, is_active, updated_at");

  if (!input.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("name");

  if (error) return { ok: false, code: "unknown" };

  return { ok: true, authors: (data as Record<string, unknown>[]).map(mapRow) };
}
