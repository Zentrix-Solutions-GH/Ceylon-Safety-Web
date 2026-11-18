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
      "id, entitlement_id, user_id, note, requested_at, " +
      "buyer_name, buyer_email, document_title, language, last_download_at"
    )
    .eq("status", "open")
    .order("requested_at", { ascending: true });

  if (error) return { ok: false, code: "unknown" };

  const items: DownloadQueueItem[] = ((rows as Array<Record<string, unknown>>) ?? []).map((r) => ({
    requestId:      String(r["id"] ?? ""),
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
  if (!z.string().uuid().safeParse(requestId).success) {
    return { ok: false, code: "validation_failed" };
  }

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  const rl = await checkActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  const sbService = await createSupabaseServiceRoleClient();

  // Fetch the request (user-scoped client respects RLS; staff sees all via staff policy)
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

  if (rpcErr) return { ok: false, code: "unknown" };

  return { ok: true };
}

// ─── rejectDownloadRequest (AC11) ────────────────────────────────────────────

export async function rejectDownloadRequest(
  requestId: string,
  note: string
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(requestId).success) {
    return { ok: false, code: "validation_failed" };
  }
  if (!z.string().min(1).max(500).safeParse(note?.trim()).success) {
    return { ok: false, code: "validation_failed", field: "note" };
  }

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

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

  // Fetch buyer profile for email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: buyer } = await (sbService as any)
    .from("profiles")
    .select("id, email")
    .eq("id", (req as { user_id: string }).user_id)
    .single();

  // Mark rejected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (sbService as any)
    .from("download_requests")
    .update({
      status:       "rejected",
      decided_by:   actor.id,
      decided_at:   new Date().toISOString(),
      decision_note: note.trim(),
    })
    .eq("id", requestId)
    .eq("status", "open");

  if (updateErr) return { ok: false, code: "unknown" };

  // Write audit row (best-effort)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sbService as any).from("admin_audit_log").insert({
    actor_id:    actor.id,
    action:      "download_request.reject",
    entity_type: "download_request",
    entity_id:   requestId,
  });

  // Queue rejection email
  const buyerEmail = (buyer as { email?: string | null } | null)?.email;
  if (buyerEmail) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sbService as any).from("email_logs").insert({
      to_email:     buyerEmail,
      template:     "download_request_rejected",
      related_type: "download_request",
      related_id:   requestId,
      status:       "queued",
    });
  }

  return { ok: true };
}
