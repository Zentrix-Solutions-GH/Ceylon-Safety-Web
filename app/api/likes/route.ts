import { NextRequest, NextResponse } from "next/server";

// Limit request body size (AC11)
export const config = { api: { bodyParser: { sizeLimit: "1kb" } } };
import { requireActiveAccount, getCurrentUser } from "@/lib/auth/server";
import { toggleLike, getLikeStatus } from "@/lib/engagement/toggleLike";
import { likeBodySchema, likeQuerySchema } from "@/lib/validation/comment";

// POST /api/likes — toggle a like (AC1)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireActiveAccount();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.code }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const parsed = likeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { id } = parsed.data;

  const result = await toggleLike(auth.user.id, id);

  if (!result.ok) {
    const status = result.code === "rate_limited" ? 429 : result.code === "not_allowed" ? 403 : 400;
    return NextResponse.json({ error: result.code }, { status });
  }

  return NextResponse.json({ liked: result.liked, count: result.count });
}

// GET /api/likes?kind=article&id=... — read like status (AC2)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const rawQuery = Object.fromEntries(searchParams.entries());

  const parsed = likeQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { id } = parsed.data;

  // Try to get current user (optional auth)
  const user = await getCurrentUser();

  const result = await getLikeStatus(user?.id ?? null, id);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
