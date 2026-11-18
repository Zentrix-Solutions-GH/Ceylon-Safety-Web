import "server-only";

import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { headObject, presignedGet } from "@/lib/r2/storage";
import { r2Config } from "@/lib/config";
import type { ActionResult } from "@/types/api";
import type { DownloadPageData } from "@/types/entitlement";

const DOWNLOAD_LINK_TTL_SECONDS = 60;

// ─── claimDownload ───────────────────────────────────────────────────────────

export interface ClaimDownloadParams {
  entitlementId: string;
  userId: string;
  ipHash: string;
  documentTitle?: string;
  language?: string;
  format?: string;
}

export interface ClaimDownloadData {
  signedUrl: string;
}

// ceylonsafety DB functions raise with ERRCODE restrict_violation or no_data_found.
// Guard on those codes before parsing the message so an unrelated Postgres error
// (e.g. a network or schema error) never accidentally matches a ceylonsafety keyword.
const CLAIM_ERROR_CODES = new Set(["restrict_violation", "no_data_found", "insufficient_privilege"]);

function mapClaimError(err: { code?: string; message?: string }): string {
  if (!CLAIM_ERROR_CODES.has(err.code ?? "")) return "unknown";
  const msg = err.message ?? "";
  if (msg.includes("download_limit_reached")) return "download_limit_reached";
  if (msg.includes("no_ready_file_for_language")) return "file_unavailable";
  if (msg.includes("does not belong")) return "not_found";
  if (msg.includes("not found")) return "not_found";
  if (msg.includes("revoked")) return "not_found";
  return "unknown";
}

export async function claimDownload(
  params: ClaimDownloadParams
): Promise<ActionResult<ClaimDownloadData>> {
  const { entitlementId, userId, ipHash, documentTitle, language, format } = params;

  const sbService = await createSupabaseServiceRoleClient();

  // Step 1: atomic claim (locks row, checks ownership/limit, writes log, returns file key + log id)
  // claim_download is in the private schema so it is not in the generated public types — cast to any.
  // claim_download returns TABLE(file_key text, log_id bigint) — Supabase wraps it as an array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claimRows, error: claimErr } = await (sbService as any).rpc("claim_download", {
    p_user_id: userId,
    p_entitlement_id: entitlementId,
    p_ip_hash: ipHash,
  }) as { data: Array<{ file_key: string; log_id: number }> | null; error: { code?: string; message?: string } | null };

  if (claimErr || !claimRows?.length) {
    if (claimErr?.message?.includes("no_ready_file_for_language")) {
      return { ok: false, code: "file_unavailable" };
    }
    return { ok: false, code: mapClaimError(claimErr ?? {}) };
  }

  const { file_key: fileKey, log_id: logId } = claimRows[0];

  // Step 2: verify file exists in R2 private bucket
  const cfg = r2Config();
  if (!cfg) return { ok: false, code: "unknown" };

  const exists = await headObject(cfg.bucketPrivate, fileKey);
  if (!exists) {
    // Undo the claim — file is missing in store (private schema, cast to any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sbService as any).rpc("release_download", {
      p_entitlement_id: entitlementId,
      p_log_id: logId,
    });
    // Alert admin (best-effort: insert queued email_logs row; to_email null = admin queue)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sbService as any).from("email_logs").insert({
      to_email:     null,
      template:     "admin_file_missing",
      related_type: "entitlement",
      related_id:   entitlementId,
      status:       "queued",
    });
    return { ok: false, code: "file_unavailable" };
  }

  // Step 3: generate one-time signed link with clean file name
  const fileName = buildFileName(documentTitle, language, format);
  const signedUrl = await presignedGet(cfg.bucketPrivate, fileKey, DOWNLOAD_LINK_TTL_SECONDS, {
    responseContentDisposition: `attachment; filename="${fileName}"`,
  });

  return { ok: true, data: { signedUrl } };
}

function buildFileName(title?: string, language?: string, format?: string): string {
  const parts = [title ?? "document", language].filter(Boolean);
  const ext = format ?? "pptx";
  return parts.join("-").replace(/[^a-zA-Z0-9._-]/g, "_") + "." + ext;
}

// ─── getDownloadPageData ──────────────────────────────────────────────────────

export interface GetDownloadPageDataParams {
  orderItemId: string;
  userId: string;
}

export async function getDownloadPageData(
  params: GetDownloadPageDataParams
): Promise<ActionResult<DownloadPageData>> {
  const { orderItemId, userId } = params;

  if (!z.string().uuid().safeParse(orderItemId).success) {
    return { ok: false, code: "not_found" };
  }

  // User-scoped client so RLS hides rows that don't belong to this user
  const sb = await createSupabaseServerClient();

  // Find the entitlement for this order item (owner only via RLS)
  const { data: ent, error: entErr } = await sb
    .from("entitlements")
    .select("id, user_id, document_id, order_item_id, language, download_limit, downloads_used")
    .eq("order_item_id", orderItemId)
    .single();

  if (entErr || !ent) return { ok: false, code: "not_found" };

  // Double-check ownership (belt + suspenders; RLS should already enforce this)
  if (ent.user_id !== userId) return { ok: false, code: "not_found" };

  // Get title snapshot from order_items
  const { data: item, error: itemErr } = await sb
    .from("order_items")
    .select("title_snapshot, language")
    .eq("id", orderItemId)
    .single();

  if (itemErr || !item) return { ok: false, code: "not_found" };

  return {
    ok: true,
    data: {
      entitlementId: ent.id,
      titleSnapshot: item.title_snapshot,
      language: ent.language ?? item.language,
      downloadsLeft: Math.max(0, ent.download_limit - ent.downloads_used),
    },
  };
}
