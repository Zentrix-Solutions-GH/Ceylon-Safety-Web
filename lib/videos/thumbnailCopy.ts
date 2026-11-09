import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Config, serverConfig } from "@/lib/config";
import { checkRealType } from "@/lib/media/checkRealType";

type ThumbnailCopyResult =
  | { ok: true; thumbnailKey: string; thumbnailSource: "youtube_copy"; placeholderUsed?: boolean }
  | { ok: false; code: string };

// YouTube thumbnail quality ladder (highest first).
const QUALITIES = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"] as const;

// A "grey placeholder" thumbnail is YouTube's 120x90 no-thumbnail image.
// Detected by file size under 2 KB (the real 120x90 JPEG is about 1.4 KB).
const PLACEHOLDER_SIZE_THRESHOLD = 2048;

const MAX_SIZE = 500 * 1024; // 500 KB
const FETCH_TIMEOUT_MS = 5000;

function thumbnailUrl(youtubeId: string, quality: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg`;
}

async function fetchThumbnail(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const controller = new AbortController();
  // Timer covers both headers and body — cleared only after arrayBuffer() completes.
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  let buffer: ArrayBuffer;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) { clearTimeout(timer); return null; }

    // Check content-length header first to avoid downloading oversized files
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) { clearTimeout(timer); return null; }

    buffer = await response.arrayBuffer();
    clearTimeout(timer);
  } catch {
    clearTimeout(timer);
    return null;
  }

  if (buffer.byteLength > MAX_SIZE) return null;

  // Grey placeholder detection: unusually small file
  if (buffer.byteLength < PLACEHOLDER_SIZE_THRESHOLD) return null;

  const bytes = new Uint8Array(buffer);
  const mime = checkRealType(bytes);
  if (!mime) return null;

  return { bytes, mime };
}

async function putToR2(key: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  const cfg = r2Config();
  if (!cfg) return false;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  try {
    await client.send(new PutObjectCommand({
      Bucket: cfg.bucketPublic,
      Key: key,
      Body: bytes,
      ContentType: mime,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function copyYouTubeThumbnail(youtubeId: string): Promise<ThumbnailCopyResult> {
  for (const quality of QUALITIES) {
    const url = thumbnailUrl(youtubeId, quality);
    const result = await fetchThumbnail(url);
    if (!result) continue;

    const ext = result.mime === "image/png" ? "png" : result.mime === "image/webp" ? "webp" : "jpg";
    const key = `thumbnails/${youtubeId}_${quality}.${ext}`;

    const uploaded = await putToR2(key, result.bytes, result.mime);
    if (!uploaded) continue;

    return { ok: true, thumbnailKey: key, thumbnailSource: "youtube_copy" };
  }

  // All qualities failed — use the configured placeholder key (AC5)
  return {
    ok: true,
    thumbnailKey: serverConfig.videoPlaceholderKey,
    thumbnailSource: "youtube_copy",
    placeholderUsed: true,
  };
}
