import { type NextRequest, NextResponse } from "next/server";
import { searchContent } from "@/lib/search/searchContent";
import { getClientIp } from "@/lib/ratelimit/client-ip";
import type { SearchScope } from "@/types/api";

const NO_STORE = "no-store, no-cache, must-revalidate";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const scope = (searchParams.get("scope") ?? "home") as SearchScope;
  const query = searchParams.get("q") ?? "";

  const remoteAddr = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const ip = getClientIp(req.headers, remoteAddr) ?? "unknown";

  const result = await searchContent({ scope, query }, ip);

  if (!result.ok) {
    const status =
      result.code === "validation_failed" ? 400 : result.code === "rate_limited" ? 429 : 500;
    return NextResponse.json({ error: result.code }, { status });
  }

  return NextResponse.json(
    { items: result.data ?? [] },
    { headers: { "cache-control": NO_STORE } }
  );
}
