import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { requireActiveAccount } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ratelimit/client-ip";
import { claimDownload } from "@/lib/downloads/claim";

// AC1: 30 POST requests per hour per authenticated user.
const DOWNLOAD_RATE_LIMIT = { maxCount: 30, windowSeconds: 3600 };

// AC1: GET is refused — a browser prefetch or link must never use up a download.
export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entitlementId: string }> }
): Promise<NextResponse> {
  // AC1: sign-in and active account required
  const auth = await requireActiveAccount();
  if (!auth.ok) {
    const status = auth.code === "not_allowed" ? 403 : 401;
    return NextResponse.json({ code: auth.code }, { status });
  }
  const user = auth.user;

  // AC1: rate limit per user (not per IP — the IP is only hashed into the log)
  const rl = await checkRateLimit({
    limitName: "download",
    key: user.id,
    ...DOWNLOAD_RATE_LIMIT,
    mode: "closed",
  });
  if (!rl.ok) return NextResponse.json({ code: "rate_limited" }, { status: 429 });

  const { entitlementId } = await params;

  if (!z.string().uuid().safeParse(entitlementId).success) {
    return NextResponse.json({ code: "validation_failed" }, { status: 400 });
  }

  // Optional metadata for a human-readable Content-Disposition filename.
  // S-095 (download page) passes these; they are display-only and do not
  // affect the security or correctness of the claim.
  let documentTitle: string | undefined;
  let language: string | undefined;
  let format: string | undefined;
  try {
    const body = await req.json();
    const BodySchema = z.object({
      documentTitle: z.string().max(200).optional(),
      language:      z.string().max(10).optional(),
      format:        z.string().max(20).optional(),
    });
    const parsed = BodySchema.safeParse(body);
    if (parsed.success) {
      ({ documentTitle, language, format } = parsed.data);
    }
  } catch {
    // No body or invalid JSON — proceed without metadata (filename falls back to document.pptx)
  }

  // Hash the client IP for the download log (AC2); never log the raw IP.
  const rawIp = getClientIp(req.headers, undefined) ?? "unknown";
  const ipHash = createHash("sha256").update(rawIp).digest("hex");

  const result = await claimDownload({ entitlementId, userId: user.id, ipHash, documentTitle, language, format });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      download_limit_reached: 402,
      file_unavailable:       503,
      not_found:              404,
      not_allowed:            403,
      rate_limited:           429,
    };
    const status = statusMap[result.code] ?? 500;
    return NextResponse.json({ code: result.code }, { status });
  }

  // AC5: return only the signed URL — no file key, no bucket path
  const signedUrl = result.data?.signedUrl;
  if (!signedUrl) {
    return NextResponse.json({ code: "unknown" }, { status: 500 });
  }
  return NextResponse.json(
    { url: signedUrl },
    { headers: { "Cache-Control": "no-store" } }
  );
}
