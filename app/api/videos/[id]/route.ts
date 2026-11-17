import { NextRequest, NextResponse } from "next/server";
import { getPublishedVideo } from "@/lib/feed/query";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await getPublishedVideo(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: 404 });
  }
  return NextResponse.json({ ok: true, video: result.video });
}
