import { NextRequest, NextResponse } from "next/server";
import { getCounters } from "@/lib/counters";
import { applyCountersRateLimit } from "@/lib/feed/query";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateResult = await applyCountersRateLimit(ip);
  if (!rateResult.ok) {
    return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429 });
  }

  const counters = await getCounters();
  return NextResponse.json({ ok: true, data: counters });
}
