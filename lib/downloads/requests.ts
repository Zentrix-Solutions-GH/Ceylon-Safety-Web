import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/api";

// ─── requestDownload ─────────────────────────────────────────────────────────

export interface RequestDownloadParams {
  entitlementId: string;
  userId: string;
  note?: string;
}

export async function requestDownload(
  params: RequestDownloadParams
): Promise<ActionResult<{ requestId: string }>> {
  const { entitlementId, userId, note } = params;

  if (!z.string().uuid().safeParse(entitlementId).success) {
    return { ok: false, code: "not_found" };
  }

  // User-scoped client — RLS enforces ownership
  const sb = await createSupabaseServerClient();

  // Verify the entitlement belongs to this user (RLS: own rows only)
  const { data: ent, error: entErr } = await sb
    .from("entitlements")
    .select("id, user_id")
    .eq("id", entitlementId)
    .single();

  if (entErr || !ent) return { ok: false, code: "not_found" };

  // Guard: one open request per purchase at a time (AC9, EC5)
  const { data: existing } = await sb
    .from("download_requests")
    .select("id")
    .eq("entitlement_id", entitlementId)
    .eq("status", "open")
    .single();

  if (existing) return { ok: false, code: "request_already_open" };

  // Sanitise optional note (max 500 chars)
  const safeNote = note ? z.string().max(500).safeParse(note).success ? note.slice(0, 500) : null : null;

  // Insert new open request
  // Unique index (entitlement_id WHERE status='open') is the final guard against
  // the TOCTOU race: if two callers pass the SELECT check concurrently, the
  // second INSERT hits a unique_violation (23505) → request_already_open.
  const { data: req, error: insertErr } = await sb
    .from("download_requests")
    .insert({
      entitlement_id: entitlementId,
      user_id: userId,
      status: "open",
      note: safeNote,
    })
    .select("id")
    .single();

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      return { ok: false, code: "request_already_open" };
    }
    return { ok: false, code: "unknown" };
  }
  if (!req) return { ok: false, code: "unknown" };

  return { ok: true, data: { requestId: req.id } };
}
