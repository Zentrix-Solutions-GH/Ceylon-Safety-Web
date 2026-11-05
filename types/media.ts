// Media types for image upload flow (S-047).
// Server actions: lib/media/actions/getImageUploadLink.ts, confirmImageUpload.ts
// Consumers: S-055 (image block), S-057 (cover image), S-063 (video thumbnail)

export type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";

export type MediaVariantInput = {
  /** Target width in pixels. Must be > 0 and ≤ 1200. */
  width: number;
  /** Size cap in bytes for server-side enforcement after upload. */
  sizeCap: number;
  /** Declared MIME type for this variant. Must be an allowed image type. */
  mimeType: AllowedImageMime;
};

export type GetImageUploadLinkInput = {
  /** Overall session MIME type (the original file type before resizing). */
  mimeType: AllowedImageMime;
  /** One or two variant descriptors. Widths must be unique and > 0. */
  variants: [MediaVariantInput] | [MediaVariantInput, MediaVariantInput];
  /** Optional: retry an existing pending row owned by the caller. */
  mediaId?: string;
};

export type UploadLink = {
  width: number;
  url: string;
  mimeType: AllowedImageMime;
};

export type GetImageUploadLinkResult =
  | { ok: true; mediaId: string; links: UploadLink[] }
  | { ok: false; code: "validation_failed" | "not_allowed" | "rate_limited" | "not_found" | "server_error" };

export type ConfirmImageUploadResult =
  | { ok: true; mediaId: string }
  | { ok: false; code: "not_found" | "upload_failed" | "not_allowed" | "server_error" };
