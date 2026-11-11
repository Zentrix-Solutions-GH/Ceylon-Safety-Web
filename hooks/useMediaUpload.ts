"use client";

import { useState, useCallback, useRef } from "react";
import { getImageUploadLink } from "@/lib/media/actions/getImageUploadLink";
import { confirmImageUpload } from "@/lib/media/actions/confirmImageUpload";
import type { ResizedVariant } from "@/lib/content/image-resize";
import type { AllowedImageMime, GetImageUploadLinkInput } from "@/types/media";

export type UploadStatus = "idle" | "uploading" | "pending" | "ready" | "error" | "upload_failed";
export type UploadErrorCode = "rate_limited" | "not_allowed" | "validation_failed" | "network" | "server_error" | "location_data_found" | null;

interface UseMediaUploadOptions {
  onSuccess?: (mediaId: string) => void;
  onError?: (code: UploadErrorCode) => void;
  onUploadFailed?: () => void;
}

interface UseMediaUploadReturn {
  status: UploadStatus;
  errorCode: UploadErrorCode;
  upload: (variants: ResizedVariant[], originalMime: AllowedImageMime) => Promise<void>;
  retry: () => Promise<void>;
}

export function useMediaUpload(options: UseMediaUploadOptions): UseMediaUploadReturn {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorCode, setErrorCode] = useState<UploadErrorCode>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Monotonic counter — incremented each runUpload call so stale responses are ignored
  const uploadIdRef = useRef(0);

  // Keep last upload args for retry
  const lastVariantsRef = useRef<ResizedVariant[] | null>(null);
  const lastMimeRef = useRef<AllowedImageMime | null>(null);
  const pendingMediaIdRef = useRef<string | null>(null);

  const runUpload = useCallback(
    async (variants: ResizedVariant[], originalMime: AllowedImageMime, existingMediaId?: string) => {
      uploadIdRef.current += 1;
      const thisUploadId = uploadIdRef.current;

      setStatus("uploading");
      setErrorCode(null);

      const input: GetImageUploadLinkInput = {
        mimeType: originalMime,
        variants: variants.map((v) => ({
          width: v.width,
          sizeCap: v.width <= 480 ? 120 * 1024 : 400 * 1024,
          mimeType: v.mimeType,
        })) as GetImageUploadLinkInput["variants"],
        ...(existingMediaId ? { mediaId: existingMediaId } : {}),
      };

      const linkResult = await getImageUploadLink(input);

      if (!linkResult.ok) {
        const code = linkResult.code as UploadErrorCode;
        setStatus("error");
        setErrorCode(code);
        optionsRef.current.onError?.(code);
        return;
      }

      const { mediaId, links } = linkResult;
      pendingMediaIdRef.current = mediaId;

      // PUT each variant directly to R2
      try {
        await Promise.all(
          links.map((link) => {
            const variant = variants.find((v) => v.width === link.width);
            if (!variant) return Promise.resolve();
            return fetch(link.url, {
              method: "PUT",
              headers: { "Content-Type": link.mimeType },
              body: variant.blob,
            }).then((res) => {
              if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
            });
          })
        );
      } catch {
        setStatus("error");
        setErrorCode("network");
        optionsRef.current.onError?.("network");
        return;
      }

      setStatus("pending");

      const confirmResult = await confirmImageUpload(mediaId);

      // Discard result if a newer upload has started (rapid file re-pick)
      if (uploadIdRef.current !== thisUploadId) return;

      if (!confirmResult.ok) {
        setStatus("upload_failed");
        setErrorCode(confirmResult.code as UploadErrorCode);
        optionsRef.current.onUploadFailed?.();
        return;
      }

      setStatus("ready");
      optionsRef.current.onSuccess?.(mediaId);
    },
    []
  );

  const upload = useCallback(
    async (variants: ResizedVariant[], originalMime: AllowedImageMime) => {
      lastVariantsRef.current = variants;
      lastMimeRef.current = originalMime;
      pendingMediaIdRef.current = null;
      await runUpload(variants, originalMime);
    },
    [runUpload]
  );

  const retry = useCallback(async () => {
    if (!lastVariantsRef.current || !lastMimeRef.current) return;
    await runUpload(
      lastVariantsRef.current,
      lastMimeRef.current,
      pendingMediaIdRef.current ?? undefined
    );
  }, [runUpload]);

  return { status, errorCode, upload, retry };
}
