import { NextRequest, NextResponse } from "next/server";
import { getFeed, applyFeedRateLimit, parseCursor } from "@/lib/feed/query";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateResult = await applyFeedRateLimit(ip);
  if (!rateResult.ok) {
    return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429 });
  }

  const cursorParam = req.nextUrl.searchParams.get("cursor") ?? undefined;

  if (cursorParam !== undefined) {
    const parsed = parseCursor(cursorParam);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, code: "validation_failed" }, { status: 400 });
    }
  }

  const result = await getFeed(cursorParam);
  if (!result.ok) {
    if (result.code === "validation_failed") {
      return NextResponse.json({ ok: false, code: "validation_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, code: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: result.page });
}
