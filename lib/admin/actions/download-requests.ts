"use server";
import "server-only";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
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

  return { ok: true, data: { items, totalOpen: items.length } };
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

  // Fetch the request (service-role client bypasses RLS; staff permission enforced above)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req, error: reqErr } = await (sbService as any)
    .from("download_requests")
    .select("id, entitlement_id, user_id, status")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) return { ok: false, code: "not_found" };

  // AC12: already decided
  if ((req as { status: string }).status !== "open") {
    return { ok: false, code: "validation_failed", reason: "already_done" };
  }

  // AC10: self-approval refused — compare user_id only (M7 pending)
  if ((req as { user_id: string }).user_id === actor.id) {
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

  // Fetch the request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req, error: reqErr } = await (sbService as any)
    .from("download_requests")
    .select("id, entitlement_id, user_id, status")
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

  return { ok: true };
}
