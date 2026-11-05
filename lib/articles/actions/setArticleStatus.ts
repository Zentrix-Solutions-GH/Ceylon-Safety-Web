import "server-only";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { purgeArticle } from "@/lib/cache/purge";
import { writeAuditRow, writeDenied } from "@/lib/audit/index";
import type { SetArticleStatusInput, SetArticleStatusResult, MissingPublishItem } from "@/types/article";
import type { AuditEventName } from "@/types/audit";

const InputSchema = z.object({
  articleId: z.string().uuid(),
  action: z.enum(["publish", "hide", "delete"]),
  publishedAt: z.string().datetime({ offset: true }).optional(),
});

export async function setArticleStatus(input: SetArticleStatusInput): Promise<SetArticleStatusResult> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await requireStaff("articles.*");
  if (!auth.ok) {
    const actor = (auth as { user?: { id: string } }).user?.id ?? "anonymous";
    try { await writeDenied(actor, "article", input.articleId); } catch {}
    return { ok: false, code: "not_allowed" };
  }
  const actorId = auth.user.id;

  // ── Input validation ────────────────────────────────────────────────────────
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed", reason: parsed.error.issues?.[0]?.message ?? "invalid input" };
  }
  const { articleId, action, publishedAt } = parsed.data;

  const supabase = createSupabaseServiceRoleClient();

  // ── Fetch article ───────────────────────────────────────────────────────────
  const { data: article, error: fetchErr } = await supabase
    .from("articles")
    .select("id, title, excerpt, cover_image_key, cover_image_alt, author_id, category_id, status, slug, body, deleted_at")
    .eq("id", articleId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !article) {
    return { ok: false, code: "not_found" };
  }

  const a = article as Record<string, unknown>;

  // ── Publish checklist (AC7) ─────────────────────────────────────────────────
  if (action === "publish") {
    const missing: MissingPublishItem[] = [];

    if (!a.title) missing.push({ field: "title", label: "Title" });
    if (!a.excerpt) missing.push({ field: "excerpt", label: "Excerpt" });
    if (!a.category_id) missing.push({ field: "category", label: "Category" });
    if (!a.cover_image_key) missing.push({ field: "cover_image", label: "Cover image" });
    if (!a.cover_image_alt) missing.push({ field: "cover_image_alt", label: "Cover image alt text" });
    if (!publishedAt) missing.push({ field: "published_at", label: "Publish date" });

    // Active author check
    if (a.author_id) {
      const { data: author } = await supabase
        .from("authors")
        .select("id, is_active")
        .eq("id", a.author_id as string)
        .single();

      if (!author || !(author as Record<string, unknown>).is_active) {
        missing.push({ field: "active_author", label: "Active author" });
      }
    } else {
      missing.push({ field: "active_author", label: "Active author" });
    }

    // Pending images check: cover + all inline body image refs (AC7)
    const { data: bodyImageRefs } = await supabase
      .from("article_refs")
      .select("ref_id")
      .eq("article_id", articleId)
      .eq("ref_type", "media");

    const mediaKeys = [
      ...(bodyImageRefs ?? []).map((r: { ref_id: string }) => r.ref_id),
      ...(a.cover_image_key ? [a.cover_image_key as string] : []),
    ];

    if (mediaKeys.length > 0) {
      const { data: mediaRefs } = await supabase
        .from("media_assets")
        .select("status")
        .in("key", mediaKeys);

      const pendingImages = (mediaRefs ?? []) as { status: string }[];
      if (pendingImages.some(m => m.status === "pending")) {
        missing.push({ field: "images_ready", label: "All images processed" });
      }
    }

    if (missing.length > 0) {
      return { ok: false, code: "validation_failed", missing };
    }
  }

  // ── Apply status change ─────────────────────────────────────────────────────
  let auditAction: AuditEventName;
  let updatePayload: Record<string, unknown>;

  if (action === "publish") {
    auditAction = "article.publish";
    updatePayload = { status: "published", published_at: publishedAt ?? null };
  } else if (action === "hide") {
    auditAction = "article.hide";
    updatePayload = { status: "hidden" };
  } else {
    // delete — soft delete
    auditAction = "article.delete";
    updatePayload = { deleted_at: new Date().toISOString() };
  }

  const { data: updatedRow, error: updateErr } = await supabase
    .from("articles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", articleId)
    .select("id")
    .single();

  if (updateErr || !updatedRow) {
    // PGRST116 = zero rows matched (article deleted between fetch and update)
    if ((updateErr as { code?: string } | null)?.code === "PGRST116") {
      return { ok: false, code: "not_found" };
    }
    return { ok: false, code: "unknown", reason: (updateErr as { message?: string } | null)?.message ?? "update failed" };
  }

  // ── Audit row ───────────────────────────────────────────────────────────────
  await writeAuditRow({
    action: auditAction,
    actorId,
    entityType: "article",
    entityId: articleId,
    after: { action, slug: a.slug },
  });

  // ── Cache purge ─────────────────────────────────────────────────────────────
  const purgeEvent = action === "publish" ? "publish" : action === "hide" ? "hide" : "delete";
  const purgeResult = await purgeArticle(articleId, purgeEvent, actorId);
  if (!purgeResult.ok) {
    return { ok: false, code: "purge_failed" };
  }

  return { ok: true };
}
