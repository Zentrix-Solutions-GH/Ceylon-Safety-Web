import { NextRequest, NextResponse } from "next/server";
import { servePreviewFile } from "@/lib/documents/public";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { serverConfig, r2Config } from "@/lib/config";
import { getObjectStream } from "@/lib/r2/storage";
import { previewRouteSchema } from "@/lib/validation/document";
import type { DocumentLanguage } from "@/types/document";

const FORMAT_CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
): Promise<NextResponse> {
  // Rate limit by IP — mode: closed (preview images are the actual product, EC7)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit({
    limitName: "preview-route",
    key: ip,
    maxCount: serverConfig.previewRateLimitPerMinute,
    windowSeconds: 60,
    mode: "closed",
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429 });
  }

  const { documentId } = await params;
  const { searchParams } = req.nextUrl;

  // Validate inputs (AC5: page 1–3, valid UUID, known language)
  const parsed = previewRouteSchema.safeParse({
    documentId,
    language: searchParams.get("language") ?? undefined,
    page: searchParams.has("page") ? searchParams.get("page") : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "validation_failed", reason: parsed.error.issues?.[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }

  const { language, page } = parsed.data;

  // AC5: out-of-range page returns not_found, not validation_failed
  if (page < 1 || page > 3) {
    return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  }

  // Fetch the preview file key — this enforces kind=preview (EC2 guard)
  const result = await servePreviewFile(documentId, language as DocumentLanguage, page);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: 404 });
  }

  // Stream from R2 private bucket
  const cfg = r2Config();
  if (!cfg) {
    return NextResponse.json({ ok: false, code: "unknown" }, { status: 500 });
  }

  const stream = await getObjectStream(cfg.bucketPrivate, result.fileKey);
  if (!stream) {
    return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  }

  const contentType = FORMAT_CONTENT_TYPE[result.format.toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Short public cache — previews are static once uploaded
      "Cache-Control": "private, max-age=300",
    },
  });
}
