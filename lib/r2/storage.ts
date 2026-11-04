import "server-only";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Config } from "@/lib/config";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let _client: S3Client | null = null;

function getClient(): S3Client {
  const cfg = r2Config();
  if (!cfg) throw new Error("[r2] R2 environment variables not configured");
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return _client;
}

// Exposed for tests to inject a mock client. Guard prevents accidental use in production.
export function _setClientForTest(client: S3Client | null): void {
  if (process.env.NODE_ENV !== "test") return;
  _client = client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const PRESIGN_TTL_SECONDS = 300; // 5 minutes

export async function presignedPut(
  bucket: string,
  key: string,
  mimeType: string,
  ttlSeconds = PRESIGN_TTL_SECONDS,
  maxBytes?: number
): Promise<string> {
  const client = getClient();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
    ...(maxBytes !== undefined ? { ContentLength: maxBytes } : {}),
  });
  return getSignedUrl(client, cmd, { expiresIn: ttlSeconds });
}

/** Read the first `maxBytes` bytes of an R2 object. Returns null on any error. */
export async function getObjectBytes(
  bucket: string,
  key: string,
  maxBytes: number
): Promise<Uint8Array | null> {
  try {
    const client = getClient();
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${maxBytes - 1}`,
    });
    const res = await client.send(cmd);
    if (!res.Body) return null;
    // ReadableStream (Node.js) → Uint8Array
    const chunks: Uint8Array[] = [];
    const reader = res.Body.transformToWebStream().getReader();
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
  } catch {
    return null;
  }
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Returns object metadata or null if the object does not exist. */
export async function headObject(
  bucket: string,
  key: string
): Promise<{ contentLength: number } | null> {
  try {
    const client = getClient();
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentLength: res.ContentLength ?? 0 };
  } catch {
    return null;
  }
}
