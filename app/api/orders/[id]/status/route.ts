import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveAccount } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

const UUIDSchema = z.string().uuid();

// Design section 5.2: at most 1 req/2s and 40 per order per user.
const THROTTLE_MAX = 1;
const THROTTLE_WINDOW = 2;
const TOTAL_MAX = 40;
const TOTAL_WINDOW = 86400; // 24h as a proxy for per-order lifetime (orders expire ≤ 48h)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: orderId } = await params;

  // AC8: validate UUID
  if (!UUIDSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // AC6: require auth
  const auth = await requireActiveAccount();
  if (!auth.ok) {
    return NextResponse.json({ error: "not_allowed" }, { status: 401 });
  }
  const userId = auth.user.id;

  // AC7: per-2s throttle (closed mode — outage denies)
  const throttleKey = `${orderId}:${userId}`;
  const throttle = await checkRateLimit({
    limitName: "status:order",
    key: throttleKey,
    maxCount: THROTTLE_MAX,
    windowSeconds: THROTTLE_WINDOW,
    mode: "closed",
  });
  if (!throttle.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // AC7: per-order total limit (closed mode)
  const totalKey = `total:${orderId}:${userId}`;
  const total = await checkRateLimit({
    limitName: "status:total",
    key: totalKey,
    maxCount: TOTAL_MAX,
    windowSeconds: TOTAL_WINDOW,
    mode: "closed",
  });
  if (!total.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // AC6: fetch order — filter by id AND user_id (never leaks existence to other users)
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { status: data.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
