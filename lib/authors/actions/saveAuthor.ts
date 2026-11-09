import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit";
import { generateSlug } from "@/lib/content/slug";
import { saveAuthorSchema } from "@/lib/validation/author";
import type { SaveAuthorInput, SaveAuthorResult } from "@/types/author";
import { ANON_ACTOR } from "@/lib/engagement/actions/constants";
import { mapRow, type AuthorRow } from "@/lib/authors/mapRow";

async function clashSafeAuthorSlug(
  baseSlug: string,
  excludeId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any }
): Promise<string> {
  let candidate = baseSlug;
  let attempt = 0;

  while (true) {
    // authors are never soft-deleted; no deleted_at column exists
    const result = await supabase
      .from("authors")
      .select("id")
      .eq("slug", candidate);

    if (result.error) throw new Error("slug_check_failed");
    const rows = (result.data ?? []) as { id: string }[];
    const clash = rows.some((r: { id: string }) => r.id !== excludeId);

    if (!clash) return candidate;

    attempt++;
    if (attempt > 100) throw new Error("slug_max_attempts");
    candidate = `${baseSlug}-${attempt}`;
  }
}

export async function saveAuthor(input: SaveAuthorInput): Promise<SaveAuthorResult> {
  const auth = await requireStaff("authors.*");
  if (!auth.ok) {
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "author",
        entityId: input.id ?? "",
        after: { permission: "authors.*" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const actorId = auth.user.id;

  const parsed = saveAuthorSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? [];
    const firstField = issues[0]?.path[0] as string | undefined;
    return { ok: false, code: "validation_failed", field: firstField ?? "name" };
  }

  const { id, name, bio, updatedAt } = parsed.data;

  // updatedAt is required for updates (admin panel section 12)
  if (id && !updatedAt) return { ok: false, code: "version_conflict" };

  const limitResult = await checkAdminWriteLimit(actorId);
  if (!limitResult.ok) return { ok: false, code: "unknown" };

  const supabase = createSupabaseServiceRoleClient();

  let data: AuthorRow | null = null;
  let dbErr: unknown = null;

  if (id) {
    // Fetch current row to decide whether the name (and therefore slug) changed.
    // Skip slug regeneration when name is unchanged to preserve stable slugs.
    const { data: current } = await supabase
      .from("authors")
      .select("name, slug")
      .eq("id", id)
      .maybeSingle();

    let slug: string;
    if (!current || current.name !== name) {
      const baseSlug = generateSlug(name);
      try {
        slug = await clashSafeAuthorSlug(baseSlug, id, supabase);
      } catch {
        return { ok: false, code: "unknown" };
      }
    } else {
      slug = current.slug as string;
    }

    const result = await supabase
      .from("authors")
      .update({ name, bio: bio ?? null, slug })
      .eq("id", id)
      .eq("updated_at", updatedAt!) // atomic version guard (admin panel section 12)
      .select("id, name, slug, bio, is_active, updated_at")
      .single();
    data = result.data as AuthorRow | null;
    dbErr = result.error;

    if ((dbErr as { code?: string } | null)?.code === "PGRST116") {
      // 0 rows: author not found or concurrently edited — distinguish with existence check
      const { data: exists } = await supabase
        .from("authors")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!exists) return { ok: false, code: "not_found" };
      return { ok: false, code: "version_conflict" };
    }
  } else {
    const baseSlug = generateSlug(name);
    let newSlug: string;
    try {
      newSlug = await clashSafeAuthorSlug(baseSlug, null, supabase);
    } catch {
      return { ok: false, code: "unknown" };
    }

    const result = await supabase
      .from("authors")
      .insert({ name, bio: bio ?? null, slug: newSlug, is_active: true })
      .select("id, name, slug, bio, is_active, updated_at")
      .single();
    data = result.data as AuthorRow | null;
    dbErr = result.error;
  }

  if (dbErr || !data) return { ok: false, code: "unknown" };

  const author = mapRow(data);

  try {
    await writeAuditRow({
      action: "author.change",
      actorId,
      entityType: "author",
      entityId: author.id,
      after: { name, slug: author.slug, bio: bio ?? null },
    });
  } catch {}

  return { ok: true, author };
}
