import { NextRequest, NextResponse } from "next/server";
import { listPublicDocuments } from "@/lib/documents/public";
import type { DocumentFilters } from "@/types/document";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const filters: DocumentFilters = {
    category: searchParams.get("category") ?? undefined,
    type: (searchParams.get("type") ?? undefined) as DocumentFilters["type"],
    sort: (searchParams.get("sort") ?? undefined) as DocumentFilters["sort"],
    page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
  };

  const result = await listPublicDocuments(filters);

  if (!result.ok) {
    if (result.code === "validation_failed") {
      return NextResponse.json({ ok: false, code: "validation_failed", reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: false, code: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result.data });
}
