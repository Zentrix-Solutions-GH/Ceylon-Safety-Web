"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getObjectBytes, deleteObject, headObject } from "@/lib/r2/storage";
import { variantKey } from "@/lib/media/variantKey";
import { checkRealType } from "@/lib/media/checkRealType";
import { checkGps } from "@/lib/media/checkGps";
import { readDimensions } from "@/lib/media/readDimensions";
import { r2Config } from "@/lib/config";
import type { ConfirmImageUploadResult, AllowedImageMime } from "@/types/media";

// Design constants from content design section 14.1
// 480 px copy → 120 KB max; 1200 px copy → 400 KB max
const VARIANT_CAPS: Record<number, number> = {
  480: 120 * 1024,
  1200: 400 * 1024,
};
// Standard widths checked in order
const STANDARD_WIDTHS = [480, 1200];
// Tolerance for pixel-width comparison (±2 px, AC5)
const WIDTH_TOLERANCE = 2;
// How many bytes to read for type/GPS/dimension checks
const READ_BYTES = 64 * 1024; // 64 KB is sufficient for EXIF and image headers

const ConfirmSchema = z.object({ mediaId: z.string().uuid() });

export async function confirmImageUpload(
  mediaId: string
): Promise<ConfirmImageUploadResult> {
  // --- Input validation ---
  const parsed = ConfirmSchema.safeParse({ mediaId });
  if (!parsed.success) return { ok: false, code: "not_found" };

  // --- Auth ---
  const authResult = await requireStaff("media.upload");
  if (!authResult.ok) {
    return { ok: false, code: "not_allowed" }; // auth layer already logs the denied event
  }
  const actorId = authResult.user.id;

  const cfg = r2Config();
  if (!cfg) return { ok: false, code: "not_found" };

  const supabase = createSupabaseServiceRoleClient();

  // --- Load row ---
  const { data: row } = await supabase
    .from("media_assets")
    .select("id, status, uploaded_by, file_key, mime_type")
    .eq("id", mediaId)
    .single();

  if (!row) return { ok: false, code: "not_found" };

  // EC-C: row owned by a different staff member looks like not_found
  if (row.uploaded_by !== actorId) return { ok: false, code: "not_found" };

  // EC2: already ready → safe repeat
  if (row.status === "ready") return { ok: true, mediaId };

  if (row.status !== "pending") return { ok: false, code: "not_found" };

  const fileKey = row.file_key as string;
  const declaredMime = row.mime_type as AllowedImageMime;

  // --- Check each standard variant ---
  const keysToDelete: string[] = [];
  let totalSize = 0;
  let finalWidth = 0;
  let finalHeight = 0;
  let foundAny = false;

  for (const width of STANDARD_WIDTHS) {
    const vKey = variantKey(fileKey, width);
    const head = await headObject(cfg.bucketPublic, vKey);
    if (!head) return { ok: false, code: "upload_failed" }; // AC5: all declared variants must exist

    foundAny = true;

    // EC4: R2 error reading bytes
    const bytes = await getObjectBytes(cfg.bucketPublic, vKey, READ_BYTES);
    if (!bytes) {
      // Leave row pending, return failure (EC4)
      return { ok: false, code: "upload_failed" };
    }

    // EC-E: zero-byte object
    if (bytes.length === 0) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }

    // AC4: real type check
    const realType = checkRealType(bytes);
    if (!realType) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }
    // EC3: declared type mismatch
    if (realType !== declaredMime) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }

    // AC5: size cap (use specific cap if known, else use head.contentLength)
    const cap = VARIANT_CAPS[width];
    if (cap !== undefined && head.contentLength > cap) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }

    // AC5: pixel width check (±2 px tolerance)
    const dims = readDimensions(bytes);
    if (!dims) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }
    if (Math.abs(dims.width - width) > WIDTH_TOLERANCE) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }

    // AC6: GPS check
    if (checkGps(bytes)) {
      keysToDelete.push(vKey);
      await _deleteAll(cfg.bucketPublic, keysToDelete);
      return { ok: false, code: "upload_failed" };
    }

    totalSize += head.contentLength;
    // Keep the largest variant's dimensions for the row
    if (dims.width > finalWidth) {
      finalWidth = dims.width;
      finalHeight = dims.height;
    }
  }

  if (!foundAny) {
    return { ok: false, code: "upload_failed" };
  }

  // --- Mark row ready (AC7) ---
  // .select("id") lets us detect whether the update matched a row (EC7: optimistic lock)
  const { data: updated, error: updateError } = await supabase
    .from("media_assets")
    .update({
      status: "ready",
      mime_type: declaredMime,
      size_bytes: totalSize,
      width: finalWidth,
      height: finalHeight,
    })
    .eq("id", mediaId)
    .eq("status", "pending") // optimistic lock — only one concurrent caller wins
    .select("id");

  if (updateError || !updated || updated.length === 0) {
    // Another concurrent call already set status to ready — safe repeat, no double audit
    return { ok: true, mediaId };
  }

  // --- Audit row (AC7) — written only by the caller that won the optimistic lock ---
  await writeAuditRow({
    action: "image.upload",
    actorId,
    entityType: "media_assets",
    entityId: mediaId,
  }).catch(() => {});

  return { ok: true, mediaId };
}

async function _deleteAll(bucket: string, keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => deleteObject(bucket, k).catch(() => {})));
}
