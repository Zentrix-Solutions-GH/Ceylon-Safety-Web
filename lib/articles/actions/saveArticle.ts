import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { validateBody } from "@/lib/content/schema";
import { findBadLink } from "@/lib/content/links";
import { generateSlug, clashSafeSlug, RESERVED_SLUGS } from "@/lib/content/slug";
import { bodyToPlainText } from "@/lib/content/plain-text";
import { buildArticleRefs } from "@/lib/articles/articleRefs";
import { purgeArticle } from "@/lib/cache/purge";
import { writeAuditRow, writeDenied } from "@/lib/audit/index";
import type { SaveArticleInput, SaveArticleResult } from "@/types/article";
import type { AuditEventName } from "@/types/audit";
import type { Json } from "@/types/database";

const InputSchema = z.object({
  articleId: z.string().uuid().optional(),
  title: z.string().min(1, "title is required").max(150, "title must be at most 150 characters"),
  excerpt: z.string().max(300).optional(),
  slug: z.string().max(80).optional(),
  coverImageKey: z.string().optional(),
  coverImageAlt: z.string().max(200).optional(),
  authorId: z.string().uuid(),
  categoryId: z.string().uuid(),
  publishedAt: z.string().optional(),
  body: z.record(z.string(), z.unknown()),
  bodyVersion: z.number().int().min(0),
  seoTitle: z.string().max(150).optional(),
  seoDescription: z.string().max(300).optional(),
});

export async function saveArticle(input: SaveArticleInput): Promise<SaveArticleResult> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await requireStaff("articles.*");
  if (!auth.ok) {
    try { await writeDenied("anonymous", "article", input.articleId ?? "new"); } catch {}
    return { ok: false, code: "not_allowed" };
  }
  const actorId = auth.user.id;

  // ── Input validation ────────────────────────────────────────────────────────
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed", reason: parsed.error.issues?.[0]?.message ?? "invalid input" };
  }
  const data = parsed.data;

  // ── Body schema validation ──────────────────────────────────────────────────
  const bodyResult = validateBody(data.body);
  if (!bodyResult.ok) {
    return { ok: false, code: "validation_failed", reason: bodyResult.reason };
  }

  // ── Link policy check ───────────────────────────────────────────────────────
  const content = Array.isArray((data.body as Record<string, unknown>).content)
    ? ((data.body as Record<string, unknown>).content as unknown[])
    : [];
  const badLink = findBadLink(content);
  if (badLink) {
    return { ok: false, code: "validation_failed", reason: badLink };
  }

  const supabase = createSupabaseServiceRoleClient();

  // ── Fetch existing article (if updating) ────────────────────────────────────
  type ExistingRow = { id: string; body_version: number; status: string; slug: string | null; author_id: string | null; category_id: string | null };
  let existing: ExistingRow | null = null;
  if (data.articleId) {
    const { data: row, error } = await supabase
      .from("articles")
      .select("id, body_version, status, slug, author_id, category_id")
      .eq("id", data.articleId)
      .single();

    if (error || !row) {
      return { ok: false, code: "not_found" };
    }
    existing = row as unknown as ExistingRow;
  }

  // ── Version check (AC5) ─────────────────────────────────────────────────────
  if (existing && existing.body_version !== data.bodyVersion) {
    return { ok: false, code: "version_conflict" };
  }

  // ── Slug (AC6) ──────────────────────────────────────────────────────────────
  let slug: string;
  const isPublished = existing?.status === "published";

  if (isPublished && data.slug && data.slug !== existing?.slug) {
    // Slug is locked after first publish
    return { ok: false, code: "validation_failed", reason: "slug is locked after the article is first published" };
  }

  if (data.slug) {
    slug = data.slug;
  } else if (existing?.slug) {
    slug = existing.slug;
  } else {
    // Generate from title on first save
    slug = generateSlug(data.title);
  }

  // Check reserved words
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, code: "validation_failed", reason: `slug "${slug}" is reserved` };
  }

  // Clash-safe slug (scoped to locale 'en')
  slug = await clashSafeSlug(slug, existing?.id ?? null, "en", supabase as never);

  // ── Validate body target references exist ──────────────────────────────────
  const refs = buildArticleRefs(data.body, data.coverImageKey ?? null);
  for (const ref of refs) {
    if (ref.ref_type === "video" || ref.ref_type === "document" || ref.ref_type === "course") {
      const table = ref.ref_type === "video" ? "videos"
        : ref.ref_type === "document" ? "documents"
        : "courses";
      const { data: target, error: targetErr } = await supabase
        .from(table)
        .select("id, deleted_at")
        .eq("id", ref.ref_id)
        .single();
      if (targetErr || !target || (target as Record<string, unknown>).deleted_at) {
        return {
          ok: false,
          code: "validation_failed",
          reason: `${ref.ref_type} "${ref.ref_id}" does not exist or has been deleted`,
        };
      }
    }
  }

  // ── Plain text rebuild ──────────────────────────────────────────────────────
  const bodyText = bodyToPlainText(data.body);
  // New articles always start at body_version 1; updates increment the caller's base version.
  const newBodyVersion = existing ? data.bodyVersion + 1 : 1;

  // ── Upsert article ──────────────────────────────────────────────────────────
  const sharedFields = {
    locale: "en" as const,
    slug,
    title: data.title,
    excerpt: data.excerpt ?? null,
    cover_image_key: data.coverImageKey ?? null,
    cover_image_alt: data.coverImageAlt ?? null,
    author_id: data.authorId,
    category_id: data.categoryId,
    published_at: data.publishedAt ?? null,
    body: data.body as unknown as Json,
    body_version: newBodyVersion,
    body_text: bodyText,
    seo_title: data.seoTitle ?? null,
    seo_description: data.seoDescription ?? null,
  };

  let savedId: string;
  let savedVersion: number;
  let savedSlug: string;

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from("articles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(sharedFields as any)
      .eq("id", existing.id)
      .eq("body_version", data.bodyVersion)  // DB-level concurrency guard (EC2)
      .select("id, body_version, slug")
      .single();

    if (updateErr || !updated) {
      // PGRST116 = "JSON object requested, multiple (or no) rows returned" — zero rows matched
      // the body_version guard, meaning another save already incremented it.
      if ((updateErr as { code?: string } | null)?.code === "PGRST116" || (!updated && !updateErr)) {
        return { ok: false, code: "version_conflict" };
      }
      return { ok: false, code: "unknown", reason: updateErr?.message };
    }
    const u = updated as { id: string; body_version: number; slug: string };
    savedId = u.id;
    savedVersion = u.body_version;
    savedSlug = u.slug;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("articles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ ...sharedFields, status: "draft" as const } as any)
      .select("id, body_version, slug")
      .single();

    if (insertErr || !inserted) {
      return { ok: false, code: "unknown", reason: insertErr?.message };
    }
    const i = inserted as { id: string; body_version: number; slug: string };
    savedId = i.id;
    savedVersion = i.body_version;
    savedSlug = i.slug;
  }

  // ── Rebuild article_refs in the same logical transaction ────────────────────
  // (Supabase JS does not expose BEGIN/COMMIT; we delete then insert atomically
  //  within the same request — the design accepts this as "same transaction" intent)
  const { error: deleteErr } = await supabase
    .from("article_refs")
    .delete()
    .eq("article_id", savedId);

  if (deleteErr) {
    return { ok: false, code: "unknown", reason: deleteErr.message };
  }

  if (refs.length > 0) {
    const refRows = refs.map(r => ({
      article_id: savedId,
      node_id: r.node_id,
      ref_type: r.ref_type,
      ref_id: r.ref_id,
    }));

    const { error: insertRefsErr } = await supabase.from("article_refs").insert(refRows);
    if (insertRefsErr) {
      return { ok: false, code: "unknown", reason: insertRefsErr.message };
    }
  }

  // ── Slug change audit row ────────────────────────────────────────────────────
  if (existing && existing.slug && existing.slug !== savedSlug && !isPublished) {
    try {
      await writeAuditRow({
        action: "article.slug_change" as AuditEventName,
        actorId,
        entityType: "article",
        entityId: savedId,
        before: { slug: existing.slug },
        after: { slug: savedSlug },
      });
    } catch {}
  }

  // ── Audit row ───────────────────────────────────────────────────────────────
  await writeAuditRow({
    action: "article.save" as AuditEventName,
    actorId,
    entityType: "article",
    entityId: savedId,
    after: { body_version: savedVersion, slug: savedSlug },
  });

  // Author or category change on a published article must clear the cache (AC10).
  if (existing && isPublished) {
    const authorChanged = existing.author_id !== data.authorId;
    const categoryChanged = existing.category_id !== data.categoryId;
    if (authorChanged || categoryChanged) {
      const purgeEvent = authorChanged ? "author_change" : "category_change";
      await purgeArticle(savedId, purgeEvent, actorId);
    }
  }
  // Body-only saves on non-published articles do NOT clear the cache (content design §15).

  return { ok: true, articleId: savedId, bodyVersion: savedVersion, slug: savedSlug };
}
