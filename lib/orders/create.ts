import "server-only";

import { z } from "zod";

import { requireActiveAccount } from "@/lib/auth/server";
import { calculateCart } from "@/lib/cart/calculate";
import { checkRateLimit } from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/api";
import type {
  BillingDetails,
  BankOrderResult,
  CheckoutInput,
  CheckoutResult,
} from "@/types/order";

// ─── constants ───────────────────────────────────────────────────────────────

const CHECKOUT_RATE_LIMIT = { max: 10, windowSeconds: 3600 };
const CARD_ORDER_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const MAX_CART_LINES = 50;

const TERMS_SLUG = "terms-and-conditions";
const REFUND_SLUG = "refund-policy";

// ─── input validation ─────────────────────────────────────────────────────────

const CheckoutLineSchema = z.object({
  documentId: z.string().uuid(),
  language: z.string().min(2).max(5),
});

const BillingSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  company: z.string().optional(),
  taxId: z.string().optional(),
  saveToProfile: z.boolean().optional(),
});

const CheckoutInputSchema = z.object({
  billing: BillingSchema,
  expectedTotalCents: z.number().int().nonnegative(),
  acceptedTerms: z.boolean(),
  buyNow: CheckoutLineSchema.optional(),
});

// ─── billing validation ───────────────────────────────────────────────────────

type BillingField = "firstName" | "lastName" | "phone" | "address" | "city";

function validateBilling(
  billing: BillingDetails,
): { ok: true } | { ok: false; field: BillingField } {
  const required: BillingField[] = ["firstName", "lastName", "phone", "address", "city"];
  for (const field of required) {
    if (!billing[field] || String(billing[field]).trim() === "") {
      return { ok: false, field };
    }
  }
  return { ok: true };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function latestRevisionId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("page_revisions")
    .select("id, pages!inner(slug)")
    .eq("pages.slug", slug)
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  return data?.id ?? null;
}

async function rebuildAndValidateCart(
  userId: string,
  input: CheckoutInput,
): Promise<
  | { ok: true; lines: Awaited<ReturnType<typeof calculateCart>>; totalCents: number }
  | { ok: false; code: string; data?: unknown }
> {
  const cart = await calculateCart(userId, input.buyNow);

  if (cart.items.length === 0) return { ok: false, code: "cart_empty" };
  if (cart.items.length > MAX_CART_LINES) return { ok: false, code: "validation_failed" };

  for (const item of cart.items) {
    if (!item.available) {
      return {
        ok: false,
        code: item.unavailableReason === "language_unavailable"
          ? "language_unavailable"
          : "item_unavailable",
      };
    }
  }

  if (cart.total !== input.expectedTotalCents) {
    return { ok: false, code: "price_changed", data: cart };
  }

  if (cart.total <= 0) return { ok: false, code: "payment_unavailable" };

  return { ok: true, lines: cart, totalCents: cart.total };
}

// ─── createCheckout ───────────────────────────────────────────────────────────

export async function createCheckout(
  input: CheckoutInput,
): Promise<ActionResult<CheckoutResult>> {
  // Zod schema validation
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  // AC1: auth gate
  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  // AC2: rate limit
  const rl = await checkRateLimit({
    limitName: "checkout",
    key: user.id,
    maxCount: CHECKOUT_RATE_LIMIT.max,
    windowSeconds: CHECKOUT_RATE_LIMIT.windowSeconds,
    mode: "closed",
  });
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  // AC7: billing validation
  const billingCheck = validateBilling(input.billing);
  if (!billingCheck.ok) {
    return { ok: false, code: "billing_invalid", field: billingCheck.field };
  }

  // AC8: terms acceptance check (before fetching revisions)
  if (!input.acceptedTerms) {
    return { ok: false, code: "terms_required" };
  }

  // AC3/EC1: rebuild cart and verify price
  const cartResult = await rebuildAndValidateCart(user.id, input);
  if (!cartResult.ok) {
    return { ok: false, code: cartResult.code } as ActionResult<CheckoutResult>;
  }
  const { lines, totalCents } = cartResult;

  const supabase = await createSupabaseServerClient();

  // AC8: fetch latest terms + refund policy revisions
  const [termsRevId, refundRevId] = await Promise.all([
    latestRevisionId(supabase, TERMS_SLUG),
    latestRevisionId(supabase, REFUND_SLUG),
  ]);
  if (!termsRevId || !refundRevId) {
    return { ok: false, code: "payment_unavailable" };
  }

  const expiresAt = new Date(Date.now() + CARD_ORDER_TTL_SECONDS * 1000).toISOString();
  const billingAddress = { address: input.billing.address, city: input.billing.city };

  const orderData = {
    currency: "LKR",
    subtotal_cents: totalCents,
    discount_cents: 0,
    total_cents: totalCents,
    billing_name: `${input.billing.firstName} ${input.billing.lastName}`,
    billing_phone: input.billing.phone,
    billing_address: billingAddress,
    billing_company: input.billing.company ?? "",
    billing_tax_id: input.billing.taxId ?? "",
    billing_email: user.email,
    terms_revision_id: termsRevId,
    refund_policy_revision_id: refundRevId,
    terms_accepted_at: new Date().toISOString(),
    expires_at: expiresAt,
  };

  const items = lines.items.map((l) => ({
    document_id: l.documentId,
    language: l.language,
    title_snapshot: l.title,
    unit_price_cents: l.price,
    quantity: 1,
    line_total_cents: l.price,
    item_type: "document",
  }));

  // AC5/AC6/AC9: atomic locked insert via DB function
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_order_locked",
    {
      p_user_id: user.id,
      p_status: "pending",
      p_provider: "payhere",
      p_method: null,
      p_order_data: orderData,
      p_items: items,
    },
  );

  if (rpcError || !rpcResult) {
    return { ok: false, code: "unknown" };
  }

  const result = rpcResult as unknown as { action: string; order_id: string; order_number: string };

  if (result.action === "payment_in_progress") {
    return { ok: false, code: "payment_in_progress" };
  }
  if (result.action === "pending_order_exists") {
    return { ok: false, code: "pending_order_exists" };
  }

  // AC7: save billing to profile if requested (best-effort; never fails the checkout)
  if (input.billing.saveToProfile) {
    await supabase
      .from("profiles")
      .update({
        first_name: input.billing.firstName,
        last_name: input.billing.lastName,
        phone: input.billing.phone,
        billing_address: billingAddress,
        company_name: input.billing.company ?? null,
        tax_id: input.billing.taxId ?? null,
      })
      .eq("id", user.id);
  }

  // AC11
  return {
    ok: true,
    data: {
      orderId: result.order_id,
      orderNumber: result.order_number,
      totalCents,
    },
  };
}

// ─── createBankOrder ──────────────────────────────────────────────────────────

export async function createBankOrder(
  input: CheckoutInput,
): Promise<ActionResult<BankOrderResult>> {
  // Zod schema validation
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  // Auth gate
  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  // Rate limit
  const rl = await checkRateLimit({
    limitName: "checkout",
    key: user.id,
    maxCount: CHECKOUT_RATE_LIMIT.max,
    windowSeconds: CHECKOUT_RATE_LIMIT.windowSeconds,
    mode: "closed",
  });
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  // Billing validation
  const billingCheck = validateBilling(input.billing);
  if (!billingCheck.ok) {
    return { ok: false, code: "billing_invalid", field: billingCheck.field };
  }

  // Terms acceptance check
  if (!input.acceptedTerms) {
    return { ok: false, code: "terms_required" };
  }

  // Cart rebuild + price check
  const cartResult = await rebuildAndValidateCart(user.id, input);
  if (!cartResult.ok) {
    return { ok: false, code: cartResult.code } as ActionResult<BankOrderResult>;
  }
  const { lines, totalCents } = cartResult;

  const supabase = await createSupabaseServerClient();

  // Terms + refund revision
  const [termsRevId, refundRevId] = await Promise.all([
    latestRevisionId(supabase, TERMS_SLUG),
    latestRevisionId(supabase, REFUND_SLUG),
  ]);
  if (!termsRevId || !refundRevId) {
    return { ok: false, code: "payment_unavailable" };
  }

  const billingAddress = { address: input.billing.address, city: input.billing.city };

  const orderData = {
    currency: "LKR",
    subtotal_cents: totalCents,
    discount_cents: 0,
    total_cents: totalCents,
    billing_name: `${input.billing.firstName} ${input.billing.lastName}`,
    billing_phone: input.billing.phone,
    billing_address: billingAddress,
    billing_company: input.billing.company ?? "",
    billing_tax_id: input.billing.taxId ?? "",
    billing_email: user.email,
    terms_revision_id: termsRevId,
    refund_policy_revision_id: refundRevId,
    terms_accepted_at: new Date().toISOString(),
    // expires_at omitted — bank orders have no expiry (AC10)
  };

  const items = lines.items.map((l) => ({
    document_id: l.documentId,
    language: l.language,
    title_snapshot: l.title,
    unit_price_cents: l.price,
    quantity: 1,
    line_total_cents: l.price,
    item_type: "document",
  }));

  // AC10: bank order — no reuse/supersede rules, no card-order check
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_order_locked",
    {
      p_user_id: user.id,
      p_status: "pending_verification",
      p_provider: "bank_transfer",
      p_method: "bank_transfer",
      p_order_data: orderData,
      p_items: items,
    },
  );

  if (rpcError || !rpcResult) {
    return { ok: false, code: "unknown" };
  }

  const result = rpcResult as unknown as { action: string; order_id: string; order_number: string };

  // AC7: save billing to profile if requested (best-effort)
  if (input.billing.saveToProfile) {
    const billingAddrForProfile = { address: input.billing.address, city: input.billing.city };
    await supabase
      .from("profiles")
      .update({
        first_name: input.billing.firstName,
        last_name: input.billing.lastName,
        phone: input.billing.phone,
        billing_address: billingAddrForProfile,
        company_name: input.billing.company ?? null,
        tax_id: input.billing.taxId ?? null,
      })
      .eq("id", user.id);
  }

  return {
    ok: true,
    data: {
      orderId: result.order_id,
      orderNumber: result.order_number,
    },
  };
}

// ─── cancelPendingOrder ───────────────────────────────────────────────────────

export async function cancelPendingOrder(
  orderId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { ok: false, code: "validation_failed" };
  }

  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  const supabase = await createSupabaseServerClient();

  // Fetch the order — RLS ensures only the owner's rows are visible.
  // The .eq("user_id") below is an extra defence-in-depth check.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, status, payment_provider")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (orderError || !order) {
    return { ok: false, code: "not_found" };
  }

  // Defence-in-depth owner check (RLS + query eq already filter, but be explicit)
  if (order.user_id !== user.id) {
    return { ok: false, code: "not_allowed" };
  }

  // Terminal states: paid, failed, cancelled, refunded
  const terminalStatuses = ["paid", "failed", "cancelled", "refunded"];
  if (terminalStatuses.includes(order.status)) {
    return { ok: false, code: "validation_failed", reason: "already_done" };
  }

  if (order.payment_provider === "payhere") {
    // AC12: refuse if PayHere has an unprocessed payment event
    const { data: pendingEvent } = await supabase
      .from("payment_events")
      .select("id")
      .eq("order_id", orderId)
      .is("processed_at", null)
      .limit(1)
      .single();

    if (pendingEvent) {
      return { ok: false, code: "payment_in_progress" };
    }
  } else if (order.payment_provider === "bank_transfer") {
    // AC12/EC8: refuse if a bank slip has been uploaded
    const { data: slip } = await supabase
      .from("bank_transfer_slips")
      .select("id")
      .eq("order_id", orderId)
      .limit(1)
      .single();

    if (slip) {
      return { ok: false, code: "not_allowed" };
    }
  }

  // Cancel the order — owner check already applied above via .eq("user_id")
  const { error: cancelError } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancel_reason: "buyer_cancelled" })
    .eq("id", orderId)
    .eq("user_id", user.id);

  if (cancelError) {
    return { ok: false, code: "unknown" };
  }

  // AC12: private.release_coupon_use(order_id) is called automatically by the DB
  // trigger that fires on orders.status → 'cancelled'. In Release 1 it is a no-op;
  // Release 2 coupons will decrement uses_count via that same trigger.

  return { ok: true };
}
