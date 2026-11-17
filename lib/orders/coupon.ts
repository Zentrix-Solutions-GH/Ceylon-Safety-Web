import "server-only";

// release_coupon_use: releases the coupon reservation held against an order.
// No-op in Release 1 (coupons not shipped yet). Called from fulfil.ts on
// payment failure and cancellation (AC8) so S-082 replay and future coupon
// logic can rely on a consistent call site.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function releaseCouponUse(_order: { id: string }): Promise<void> {
  // Release 1: no-op.
}
