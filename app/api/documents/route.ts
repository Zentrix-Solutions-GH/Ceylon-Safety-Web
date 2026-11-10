import { NextRequest, NextResponse } from "next/server";
import { listPublicDocuments } from "@/lib/documents/public";
import { publicDocumentsQuerySchema } from "@/lib/validation/document";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const parsed = publicDocumentsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "validation_failed", reason: parsed.error.issues?.[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }

  const result = await listPublicDocuments(parsed.data);

  if (!result.ok) {
    if (result.code === "validation_failed") {
      return NextResponse.json({ ok: false, code: "validation_failed", reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: false, code: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result.data });
}
