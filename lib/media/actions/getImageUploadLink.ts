"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { writeDenied } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { presignedPut } from "@/lib/r2/storage";
import { variantKey } from "@/lib/media/variantKey";
import { r2Config } from "@/lib/config";
import type {
  GetImageUploadLinkInput,
  GetImageUploadLinkResult,
  AllowedImageMime,
} from "@/types/media";

const PRESIGN_TTL = 300; // 5 minutes

const ALLOWED_MIME_SCHEMA = z.enum(["image/jpeg", "image/png", "image/webp"]);

// Only the two design widths are accepted — confirmImageUpload uses fixed caps for these
const ALLOWED_WIDTHS = [480, 1200] as const;

const VariantSchema = z.object({
  width: z.number().int().refine((w) => (ALLOWED_WIDTHS as readonly number[]).includes(w), {
    message: "width must be 480 or 1200",
  }),
  sizeCap: z.number().int().min(1),
  mimeType: ALLOWED_MIME_SCHEMA,
});

const GetImageUploadLinkSchema = z.object({
  mimeType: ALLOWED_MIME_SCHEMA,
  variants: z
    .array(VariantSchema)
    .min(1)
    .max(2)
    .refine(
      (vs) => new Set(vs.map((v) => v.width)).size === vs.length,
      { message: "Variant widths must be unique" }
    ),
  mediaId: z.string().uuid().optional(),
});

export async function getImageUploadLink(
  input: GetImageUploadLinkInput
): Promise<GetImageUploadLinkResult> {
  // --- Auth ---
  const authResult = await requireStaff("media.upload");
  if (!authResult.ok) {
    try { await writeDenied("unknown", "media_assets", "media.upload"); } catch { /* audit failure is non-fatal */ }
    return { ok: false, code: "not_allowed" };
  }
  const actorId = authResult.user.id;

  // --- Rate limit — 60/hour keyed on staff user id (AC3) ---
  const rlResult = await checkRateLimit({
    limitName: "image-upload",
    key: actorId,
    maxCount: 60,
    windowSeconds: 3600,
    mode: "open",
  });
  if (!rlResult.ok && rlResult.reason === "rate_limited") {
    return { ok: false, code: "rate_limited" };
  }

  // --- Input validation — zod schema (AC2, EC-A, EC-B) ---
  const parsed = GetImageUploadLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { mimeType, variants, mediaId: retryMediaId } = parsed.data;

  const cfg = r2Config();
  if (!cfg) return { ok: false, code: "validation_failed" };

  const supabase = createSupabaseServiceRoleClient();

  // --- Retry: re-use existing pending row (AC9) ---
  if (retryMediaId) {
    const { data: existing } = await supabase
      .from("media_assets")
      .select("id, status, uploaded_by, file_key")
      .eq("id", retryMediaId)
      .single();

    if (!existing || existing.status !== "pending" || existing.uploaded_by !== actorId) {
      return { ok: false, code: "not_found" };
    }

    const links = await Promise.all(
      variants.map(async (v) => ({
        width: v.width,
        mimeType: v.mimeType as AllowedImageMime,
        url: await presignedPut(
          cfg.bucketPublic,
          variantKey(existing.file_key as string, v.width),
          v.mimeType,
          PRESIGN_TTL
        ),
      }))
    );
    return { ok: true, mediaId: existing.id as string, links };
  }

  // --- Insert new pending row (AC1) ---
  // Object key: images/{mediaId}/{8-char-random} — mediaId UUID guarantees uniqueness (EC-D)
  const mediaId = crypto.randomUUID();
  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const fileKey = `images/${mediaId}/${slug}`;

  const { data: inserted, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      id: mediaId,
      bucket: "public",
      kind: "image",
      status: "pending",
      file_key: fileKey,
      mime_type: mimeType,
      uploaded_by: actorId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false, code: "validation_failed" };
  }

  const links = await Promise.all(
    variants.map(async (v) => ({
      width: v.width,
      mimeType: v.mimeType as AllowedImageMime,
      url: await presignedPut(
        cfg.bucketPublic,
        variantKey(fileKey, v.width),
        v.mimeType,
        PRESIGN_TTL
      ),
    }))
  );

  return { ok: true, mediaId: inserted.id as string, links };
}
