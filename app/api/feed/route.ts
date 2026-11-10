import { NextRequest, NextResponse } from "next/server";
import { getFeed, applyFeedRateLimit } from "@/lib/feed/query";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) {
    const rateResult = await applyFeedRateLimit(ip);
    if (!rateResult.ok) {
      return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429 });
    }
  }

  const cursorParam = req.nextUrl.searchParams.get("cursor") ?? undefined;

  const result = await getFeed(cursorParam);
  if (!result.ok) {
    if (result.code === "validation_failed") {
      return NextResponse.json({ ok: false, code: "validation_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, code: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: result.page });
}
