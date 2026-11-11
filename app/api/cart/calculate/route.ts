import { NextRequest, NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { calculateCart } from "@/lib/cart/calculate";
import { cartCalculateBodySchema } from "@/lib/validation/cart";

const MAX_LINES = 50;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireActiveAccount();
  if (!authResult.ok) {
    if (authResult.code === "account_suspended") {
      return NextResponse.json({ ok: false, code: "not_allowed" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, code: "not_signed_in" }, { status: 401 });
  }
  const user = authResult.user;

  const rl = await checkRateLimit({
    limitName: "cart-calculate",
    key: user.id,
    maxCount: 20,
    windowSeconds: 60,
    mode: "closed",
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } },
    );
  }

  let rawBody: unknown = {};
  try {
    const text = await req.text();
    if (text) rawBody = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, code: "validation_failed" }, { status: 422 });
  }

  const parsed = cartCalculateBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "validation_failed", reason: parsed.error.issues[0]?.message },
      { status: 422 },
    );
  }

  if (parsed.data.buyNow) {
    const result = await calculateCart(user.id, parsed.data.buyNow);
    return NextResponse.json(result);
  }

  // Stored-cart path: MAX_LINES cap is enforced by addToCart; guard here as AC5 belt-and-suspenders.
  const result = await calculateCart(user.id);
  if (result.items.length > MAX_LINES) {
    return NextResponse.json({ ok: false, code: "validation_failed" }, { status: 422 });
  }

  return NextResponse.json(result);
}
