import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { presignedGet } from "@/lib/r2/storage";
import { r2Config } from "@/lib/config";

const SLIP_LINK_TTL_SECONDS = 60; // AC2: about 60 seconds

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slipId: string }> }
) {
  // AC2: auth check first to avoid leaking UUID existence to unauthenticated callers.
  const auth = await requireStaff("bank_transfers.review");
  if (!auth.ok) return new NextResponse(null, { status: 403 });

  const { slipId } = await params;

  if (!z.string().uuid().safeParse(slipId).success) {
    return new NextResponse(null, { status: 400 });
  }

  const sb = await createSupabaseServerClient();

  // Fetch the slip's file_key.
  const { data: slip, error } = await sb
    .from("bank_transfer_slips")
    .select("id, file_key")
    .eq("id", slipId)
    .single();

  if (error || !slip) return new NextResponse(null, { status: 404 });

  const cfg = r2Config();
  if (!cfg) return new NextResponse(null, { status: 503 });

  const url = await presignedGet(cfg.bucketPrivate, slip.file_key, SLIP_LINK_TTL_SECONDS);

  return NextResponse.json(
    { url, expiresInSeconds: SLIP_LINK_TTL_SECONDS },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
