import "server-only";

import { z } from "zod";

import { requireActiveAccount } from "@/lib/auth/server";
import { calculateCart } from "@/lib/cart/calculate";
import { buildPayHereRequest } from "@/lib/payhere/checkout";
import { payhereConfig, publicConfig } from "@/lib/config";
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

// P1: max() bounds prevent arbitrarily large strings from reaching the DB.
// Empty-required-field validation is handled separately by validateBilling()
// so it can return billing_invalid + field name (AC7).
const BillingSchema = z.object({
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  phone: z.string().max(30),
  address: z.string().max(500),
  city: z.string().max(200),
  company: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
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
  const { data, error } = await supabase
    .from("page_revisions")
    .select("id, pages!inner(slug)")
    .eq("pages.slug", slug)
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  // PGRST116 = no rows found (genuinely missing revision — expected case).
  // Any other error is a transient fault (network, permissions) that ops must
  // distinguish from a missing page when triaging payment_unavailable alerts.
  if (error && error.code !== "PGRST116") {
    console.error("[revision] supabase error fetching page revision", { slug, code: error.code });
  }
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

// Shared: build the item list passed to create_order_locked.
function buildOrderItems(
  lines: Awaited<ReturnType<typeof calculateCart>>,
) {
  return lines.items.map((l) => ({
    document_id: l.documentId,
    language: l.language,
    title_snapshot: l.title,
    unit_price_cents: l.price,
    quantity: 1,
    line_total_cents: l.price,
    item_type: "document",
  }));
}

// Shared: save billing details to the buyer's profile (best-effort; never fails
// the checkout). Called only when saveToProfile is set.
async function saveProfileIfRequested(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  billing: BillingDetails,
  billingAddress: { address: string; city: string },
): Promise<void> {
  if (!billing.saveToProfile) return;
  await supabase
    .from("profiles")
    .update({
      first_name: billing.firstName,
      last_name: billing.lastName,
      phone: billing.phone,
      billing_address: billingAddress,
      company_name: billing.company ?? null,
      tax_id: billing.taxId ?? null,
    })
    .eq("id", userId);
}

// ─── createCheckout ───────────────────────────────────────────────────────────

export async function createCheckout(
  input: CheckoutInput,
): Promise<ActionResult<CheckoutResult>> {
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  // AC1: auth gate
  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  // AC2: rate limit
  const rl = await checkRateLimit({
    limitName: "checkout:card",
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
    // Commerce design section 4.1: alert the admin when a revision is missing.
    // A proper alert email (S-015 monitoring story) is deferred; structured
    // server log surfaces in production monitoring in the meantime.
    console.error("[checkout] payment_unavailable — missing page revision", {
      termsRevId: termsRevId ?? "missing",
      refundRevId: refundRevId ?? "missing",
    });
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

  // AC5/AC6/AC9: atomic locked insert via DB function
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_order_locked",
    {
      p_user_id: user.id,
      p_status: "pending",
      p_provider: "payhere",
      p_order_data: orderData,
      p_items: buildOrderItems(lines),
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

  // AC7: save billing to profile if requested (best-effort)
  await saveProfileIfRequested(supabase, user.id, input.billing, billingAddress);

  // Build PayHere form fields (S-079)
  let phConfig: ReturnType<typeof payhereConfig>;
  try {
    phConfig = payhereConfig();
  } catch (err) {
    console.error("[checkout] PayHere config missing — cannot build payment request", err);
    return { ok: false, code: "payment_unavailable" };
  }

  const appUrl = publicConfig.appUrl;
  const payhereFields = buildPayHereRequest(
    { orderNumber: result.order_number, totalCents },
    {
      firstName: input.billing.firstName,
      lastName: input.billing.lastName,
      email: user.email ?? "",
      phone: input.billing.phone,
      address: input.billing.address,
      city: input.billing.city,
    },
    {
      returnUrl: `${appUrl}/checkout/success?order=${result.order_id}`,
      cancelUrl: `${appUrl}/checkout/cancel?order=${result.order_id}`,
      notifyUrl: `${appUrl}/api/payhere/notify`,
    },
    phConfig,
  );

  // AC11
  return {
    ok: true,
    data: {
      orderId: result.order_id,
      orderNumber: result.order_number,
      totalCents,
      payhereFields,
    },
  };
}

// ─── createBankOrder ──────────────────────────────────────────────────────────

export async function createBankOrder(
  input: CheckoutInput,
): Promise<ActionResult<BankOrderResult>> {
  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  // Auth gate
  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  // Rate limit
  const rl = await checkRateLimit({
    limitName: "checkout:bank",
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
    console.error("[bank-order] payment_unavailable — missing page revision", {
      termsRevId: termsRevId ?? "missing",
      refundRevId: refundRevId ?? "missing",
    });
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

  // AC10: bank order — no reuse/supersede rules, no card-order check
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_order_locked",
    {
      p_user_id: user.id,
      p_status: "pending_verification",
      p_provider: "bank_transfer",
      p_method: "bank_transfer",
      p_order_data: orderData,
      p_items: buildOrderItems(lines),
    },
  );

  if (rpcError || !rpcResult) {
    return { ok: false, code: "unknown" };
  }

  const result = rpcResult as unknown as { action: string; order_id: string; order_number: string };

  if (result.action !== "created") {
    return { ok: false, code: "unknown" };
  }

  // AC7: save billing to profile if requested (best-effort)
  await saveProfileIfRequested(supabase, user.id, input.billing, billingAddress);

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

  // P0: cancel_order_locked acquires the same per-user advisory lock as
  // create_order_locked, so the PayHere-event check and the UPDATE run atomically
  // within one transaction — the TOCTOU race is closed.
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "cancel_order_locked",
    { p_user_id: user.id, p_order_id: orderId },
  );

  if (rpcError || !rpcResult) return { ok: false, code: "unknown" };

  const result = rpcResult as { action: string };

  switch (result.action) {
    case "cancelled":           return { ok: true };
    case "not_found":           return { ok: false, code: "not_found" };
    case "already_done":        return { ok: false, code: "validation_failed", reason: "already_done" };
    case "payment_in_progress": return { ok: false, code: "payment_in_progress" };
    case "slip_uploaded":       return { ok: false, code: "not_allowed" };
    default:                    return { ok: false, code: "unknown" };
  }
}
