import { NextRequest, NextResponse } from "next/server";
import { listArticles } from "@/lib/articles/listArticles";
import type { ArticleRange, ArticleCursor } from "@/types/article";

const VALID_RANGES: ArticleRange[] = ["newest", "week", "month"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const rawRange = searchParams.get("range") ?? "newest";
  const range: ArticleRange = (VALID_RANGES as string[]).includes(rawRange)
    ? (rawRange as ArticleRange)
    : "newest";

  const category = searchParams.get("category") ?? undefined;

  let cursor: ArticleCursor | undefined;
  const rawCursor = searchParams.get("cursor");
  if (rawCursor) {
    try {
      const parsed = JSON.parse(rawCursor);
      if (
        typeof parsed?.publishedAt === "string" &&
        typeof parsed?.id === "string"
      ) {
        cursor = parsed as ArticleCursor;
      } else {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }

  const result = await listArticles({ range, category, cursor });

  if (!result.ok) {
    if (result.code === "validation_failed") {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    items: result.data.items,
    next: result.data.next,
  });
}
