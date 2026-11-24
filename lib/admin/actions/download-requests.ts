"use server";
import "server-only";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { isSelfApproval } from "@/lib/bank/review";
import { publicConfig, serverConfig } from "@/lib/config";
import { sendQueuedEmail } from "@/lib/resend/client";
import { renderDownloadApprovedEmail } from "@/lib/resend/templates/download-request-approved";
import { renderDownloadRejectedEmail } from "@/lib/resend/templates/download-request-rejected";
import type { ActionResult } from "@/types/api";
import type { DownloadQueueItem, DownloadQueueResult } from "@/types/download-request";

const PERMISSION = "download_requests.review";

function checkActionLimit(actorId: string) {
  return checkRateLimit({
    limitName: "download-request-action",
    key: actorId,
    maxCount: 20,
    windowSeconds: 60,
    mode: "closed",
  });
}

// ─── getDownloadRequestQueue (AC13) ─────────────────────────────────────────

export async function getDownloadRequestQueue(): Promise<ActionResult<DownloadQueueResult>> {
  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sbService = await createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (sbService as any)
    .from("download_request_queue")
    .select(
      "request_id, entitlement_id, note, requested_at, " +
      "buyer_name, buyer_email, document_title, language, last_download_at"
    )
    .order("requested_at", { ascending: true })
    .limit(200);

  if (error) return { ok: false, code: "unknown" };

  const items: DownloadQueueItem[] = ((rows as Array<Record<string, unknown>>) ?? []).map((r) => ({
    requestId:      String(r["request_id"] ?? ""),
    entitlementId:  String(r["entitlement_id"] ?? ""),
    buyerName:      String(r["buyer_name"] ?? ""),
    buyerEmail:     String(r["buyer_email"] ?? ""),
    documentTitle:  String(r["document_title"] ?? ""),
    language:       r["language"] != null ? String(r["language"]) : null,
    lastDownloadAt: r["last_download_at"] != null ? String(r["last_download_at"]) : null,
    note:           r["note"] != null ? String(r["note"]) : null,
    requestedAt:    String(r["requested_at"] ?? ""),
  }));

  const badgeResult = await getDownloadRequestBadgeCount();
  const totalOpen = badgeResult.ok && badgeResult.data ? badgeResult.data.count : items.length;

  return { ok: true, data: { items, totalOpen } };
}

// ─── getDownloadRequestBadgeCount (AC13, S-101) ───────────────────────────────

export async function getDownloadRequestBadgeCount(): Promise<ActionResult<{ count: number }>> {
  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sbService = await createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (sbService as any)
    .from("download_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  if (error) return { ok: false, code: "unknown" };

  return { ok: true, data: { count: count ?? 0 } };
}

// ─── approveDownloadRequest (AC10) ───────────────────────────────────────────

export async function approveDownloadRequest(
  requestId: string
): Promise<ActionResult> {
  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  if (!z.string().uuid().safeParse(requestId).success) {
    return { ok: false, code: "validation_failed" };
  }

  const rl = await checkActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  const sbService = await createSupabaseServiceRoleClient();

  // Fetch the request with buyer profile for self-approval check (AC10).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req, error: reqErr } = await (sbService as any)
    .from("download_requests")
    .select("id, entitlement_id, user_id, status, profiles(email, phone)")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) return { ok: false, code: "not_found" };

  // AC12: already decided
  if ((req as { status: string }).status !== "open") {
    return { ok: false, code: "validation_failed", reason: "already_done" };
  }

  // AC10: self-approval refused — user_id, email, and phone checks.
  const buyer = Array.isArray((req as { profiles: unknown }).profiles)
    ? ((req as { profiles: unknown[] }).profiles[0] as { email: string | null; phone: string | null } | null)
    : ((req as { profiles: unknown }).profiles as { email: string | null; phone: string | null } | null);
  if (
    isSelfApproval(
      { user_id: (req as { user_id: string }).user_id },
      buyer,
      { id: actor.id, email: actor.email, phone: (actor as { phone?: string | null }).phone ?? null }
    )
  ) {
    return { ok: false, code: "not_allowed" };
  }

  // DB function atomically: adds 1 to download_limit, marks approved,
  // writes admin_audit_log + email_logs (AC10: all in one transaction).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (sbService as any).rpc("approve_download_request", {
    p_request_id: requestId,
    p_admin_id:   actor.id,
  });

  if (rpcErr) {
    if ((rpcErr as { message?: string }).message?.includes("already_done")) {
      return { ok: false, code: "validation_failed", reason: "already_done" };
    }
    return { ok: false, code: "unknown" };
  }

  // Send the approval email now that the RPC has queued the email_logs row (S-088 AC3).
  const buyerProfile = Array.isArray((req as { profiles: unknown }).profiles)
    ? ((req as { profiles: unknown[] }).profiles[0] as { email: string | null } | null)
    : ((req as { profiles: unknown }).profiles as { email: string | null } | null);
  const buyerEmail = buyerProfile?.email;

  if (buyerEmail) {
    // Fetch order_item_id from the entitlement for the download URL.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ent } = await (sbService as any)
      .from("entitlements")
      .select("order_item_id")
      .eq("id", (req as { entitlement_id: string }).entitlement_id)
      .single() as { data: { order_item_id: string | null } | null };
    const orderItemId = ent?.order_item_id;

    if (!orderItemId) {
      console.error("[approveDownloadRequest] entitlement missing order_item_id — approval email not sent", {
        request_id: requestId,
        entitlement_id: (req as { entitlement_id: string }).entitlement_id,
      });
    } else {
      await sendQueuedEmail({
        template:    "download_request_approved",
        relatedType: "download_request",
        relatedId:   requestId,
        renderEmail: () => renderDownloadApprovedEmail({
          downloadUrl: `${publicConfig.appUrl}/download/${orderItemId}`,
          appUrl:      publicConfig.appUrl,
          supportEmail: serverConfig.emailFrom,
        }),
      });
    }
  }

  return { ok: true };
}

// ─── rejectDownloadRequest (AC11) ────────────────────────────────────────────

export async function rejectDownloadRequest(
  requestId: string,
  note: string
): Promise<ActionResult> {
  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  if (!z.string().uuid().safeParse(requestId).success) {
    return { ok: false, code: "validation_failed" };
  }
  if (!z.string().min(1).max(500).safeParse(note?.trim()).success) {
    return { ok: false, code: "validation_failed", field: "note" };
  }

  const rl = await checkActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  const sbService = await createSupabaseServiceRoleClient();

  // Fetch the request (include buyer email for rejection email, S-088 AC4)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req, error: reqErr } = await (sbService as any)
    .from("download_requests")
    .select("id, entitlement_id, user_id, status, profiles(email)")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) return { ok: false, code: "not_found" };

  // AC12: already decided
  if ((req as { status: string }).status !== "open") {
    return { ok: false, code: "validation_failed", reason: "already_done" };
  }

  // DB function atomically: marks rejected, writes admin_audit_log + email_logs
  // (AC11: all in one transaction — private schema, cast to any).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (sbService as any).rpc("reject_download_request", {
    p_request_id: requestId,
    p_admin_id:   actor.id,
    p_note:       note.trim(),
  });

  if (rpcErr) {
    if ((rpcErr as { message?: string }).message?.includes("already_done")) {
      return { ok: false, code: "validation_failed", reason: "already_done" };
    }
    return { ok: false, code: "unknown" };
  }

  // Send the rejection email now that the RPC has queued the email_logs row (S-088 AC4).
  const buyerProfile = Array.isArray((req as { profiles: unknown }).profiles)
    ? ((req as { profiles: unknown[] }).profiles[0] as { email: string | null } | null)
    : ((req as { profiles: unknown }).profiles as { email: string | null } | null);
  const buyerEmail = buyerProfile?.email;

  if (buyerEmail) {
    await sendQueuedEmail({
      template:    "download_request_rejected",
      relatedType: "download_request",
      relatedId:   requestId,
      renderEmail: () => renderDownloadRejectedEmail({
        adminNote:    note.trim(),
        supportEmail: serverConfig.emailFrom,
      }),
    });
  } else {
    console.error("[rejectDownloadRequest] no buyer email — rejection email not sent", {
      request_id: requestId,
    });
  }

  return { ok: true };
}
