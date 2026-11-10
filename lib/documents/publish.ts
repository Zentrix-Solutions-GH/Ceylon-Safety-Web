import "server-only";
import { requireStaff } from "@/lib/auth/server";
import { writeDenied, writeAuditRow } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkAdminWriteLimit } from "@/lib/ratelimit/index";
import { purgeDocument } from "@/lib/cache/purge";
import type { SetDocumentStatusResult } from "@/types/document";

const LANGUAGES = ["en", "si", "ta"] as const;

// ---------------------------------------------------------------------------
// setDocumentStatus — AC5, AC6, AC7, AC8
// ---------------------------------------------------------------------------

export async function setDocumentStatus(
  documentId: string,
  action: "publish" | "hide",
  updatedAt: string,
): Promise<SetDocumentStatusResult> {
  const auth = await requireStaff("documents.*");
  if (!auth.ok) {
    await writeDenied("unknown", "documents", action).catch(() => {});
    return { ok: false, code: "not_allowed" };
  }

  const rl = await checkAdminWriteLimit(auth.user.id);
  if (!rl.ok) return { ok: false, code: "unknown", reason: "rate_limited" };

  const supabase = createSupabaseServiceRoleClient();

  // Fetch document with optimistic concurrency (AC5, version_conflict)
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, status, updated_at, price_cents, category_id")
    .eq("id", documentId)
    .is("deleted_at", null)
    .single();

  if (docErr || !doc) return { ok: false, code: "not_found" };
  if (new Date(doc.updated_at).toISOString() !== new Date(updatedAt).toISOString()) {
    return { ok: false, code: "version_conflict" };
  }

  if (action === "publish") {
    // AC5: validate publish pre-conditions
    const missing: string[] = [];

    // Price and category (null check only — price_cents === 0 is valid for free docs)
    if (doc.price_cents == null) missing.push("price");
    if (!doc.category_id) missing.push("category");

    // Three ready full files
    const { data: fullFiles } = await supabase
      .from("document_files")
      .select("language")
      .eq("document_id", documentId)
      .eq("kind", "full")
      .eq("is_current", true)
      .eq("status", "ready");

    const readyLangs = new Set((fullFiles ?? []).map((r: { language: string }) => r.language));
    for (const lang of LANGUAGES) {
      if (!readyLangs.has(lang)) missing.push(`full:${lang}`);
    }

    // At least one ready preview (sort_order 1) per language (AC5, EC7 updated)
    const { data: previewFiles } = await supabase
      .from("document_files")
      .select("language")
      .eq("document_id", documentId)
      .eq("kind", "preview")
      .eq("sort_order", 1)
      .eq("is_current", true)
      .eq("status", "ready");

    const previewLangs = new Set((previewFiles ?? []).map((r: { language: string }) => r.language));
    for (const lang of LANGUAGES) {
      if (!previewLangs.has(lang)) missing.push(`preview:${lang}`);
    }

    if (missing.length > 0) {
      return { ok: false, code: "validation_failed", reason: "files_missing", missing };
    }
  }

  // Update status (AC5, AC6) — include updated_at filter for optimistic concurrency (P1 TOCTOU fix)
  const newStatus = action === "publish" ? "published" : "hidden";
  const { data: updated, error: updateErr } = await supabase
    .from("documents")
    .update({
      status: newStatus,
      ...(action === "publish" ? { published_at: new Date().toISOString() } : {}),
    })
    .eq("id", documentId)
    .eq("updated_at", doc.updated_at)
    .select("updated_at")
    .single();

  if (updateErr?.code === "PGRST116") {
    // Zero rows matched — another request won the race
    return { ok: false, code: "version_conflict" };
  }
  if (updateErr || !updated) {
    return { ok: false, code: "unknown", reason: updateErr?.message };
  }

  // Audit (AC8)
  const auditAction = action === "publish" ? "document.publish" : "document.hide";
  await writeAuditRow({
    action: auditAction,
    actorId: auth.user.id,
    entityType: "documents",
    entityId: documentId,
    after: { status: newStatus },
  });

  // AC7: purge caches — find articles that reference this document
  const { data: refs } = await supabase
    .from("article_refs")
    .select("article_id")
    .eq("ref_id", documentId)
    .eq("ref_type", "document");

  const articleIds = (refs ?? []).map((r: { article_id: string }) => r.article_id);
  const purgeResult = await purgeDocument(documentId, articleIds, auth.user.id);

  const purgeWarning =
    purgeResult.ok
      ? undefined
      : "The change is saved but the site may show the old page for a few minutes.";

  return {
    ok: true,
    documentId,
    updatedAt: updated.updated_at,
    ...(purgeWarning ? { purgeWarning } : {}),
  };
}
