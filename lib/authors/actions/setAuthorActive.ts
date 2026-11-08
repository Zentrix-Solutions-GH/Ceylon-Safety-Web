import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit";
import { setAuthorActiveSchema } from "@/lib/validation/author";
import type { Author, SetAuthorActiveResult } from "@/types/author";
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

export async function setAuthorActive(input: {
  id: string;
  active: boolean;
  updatedAt: string;
}): Promise<SetAuthorActiveResult> {
  const auth = await requireStaff("authors.*");
  if (!auth.ok) {
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "author",
        entityId: input.id,
        after: { permission: "authors.*" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const actorId = auth.user.id;

  const parsed = setAuthorActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "unknown" };

  const { id, active, updatedAt } = parsed.data;

  const limitResult = await checkAdminWriteLimit(actorId);
  if (!limitResult.ok) return { ok: false, code: "unknown" };

  const supabase = createSupabaseServiceRoleClient();

  // Fetch current row for version check (admin panel section 12)
  const { data: existing, error: fetchErr } = await supabase
    .from("authors")
    .select("id, updated_at")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) return { ok: false, code: "not_found" };

  const dbUpdatedAt = (existing as Record<string, unknown>).updated_at as string;
  if (dbUpdatedAt !== updatedAt) {
    return { ok: false, code: "version_conflict" };
  }

  const { data, error: updateErr } = await supabase
    .from("authors")
    .update({ is_active: active })
    .eq("id", id)
    .select("id, name, slug, bio, is_active, updated_at")
    .single();

  if (updateErr || !data) return { ok: false, code: "unknown" };

  const author = mapRow(data as Record<string, unknown>);

  try {
    await writeAuditRow({
      action: "author.change",
      actorId,
      entityType: "author",
      entityId: id,
      after: { is_active: active },
    });
  } catch {}

  return { ok: true, author };
}
