import { NextRequest, NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { postComment } from "@/lib/engagement/postComment";
import { listComments, listMyComments } from "@/lib/engagement/listComments";
import { commentsQuerySchema, postCommentBodySchema } from "@/lib/validation/comment";

const NO_STORE = "private, no-store";

// App Router does not honour export const config bodyParser; guard via Content-Length (AC11).
const COMMENTS_MAX_BYTES = 3072; // kind+id+2000-char text ≈ 2.1 KB; leave headroom

// POST /api/comments — post a comment (AC4)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > COMMENTS_MAX_BYTES) {
    return NextResponse.json({ error: "validation_failed" }, { status: 413 });
  }

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

  const parsed = postCommentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { id: articleId, text } = parsed.data;

  const result = await postComment(auth.user.id, articleId, text);

  if (!result.ok) {
    if (result.code === "rate_limited") {
      return NextResponse.json(
        { error: result.code, reason: (result as { reason?: string }).reason },
        { status: 429 }
      );
    }
    const status = result.code === "not_allowed" ? 403 : result.code === "validation_failed" ? 400 : 500;
    return NextResponse.json({ error: result.code }, { status });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}

// GET /api/comments — list comments or own comments (AC7, AC8)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const rawQuery = Object.fromEntries(searchParams.entries());

  const parsed = commentsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { id: articleId, cursor, mine } = parsed.data;

  if (mine === "1") {
    // Caller's own comments — requires auth (AC8)
    const auth = await requireActiveAccount();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.code }, { status: 401 });
    }
    const result = await listMyComments(auth.user.id, articleId);
    return NextResponse.json(result, {
      headers: { "Cache-Control": NO_STORE },
    });
  }

  // Public approved comments — no auth required (AC7)
  const result = await listComments(articleId, cursor ?? null);
  return NextResponse.json(result, {
    headers: { "Cache-Control": NO_STORE },
  });
}
