"use server";
import "server-only";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditRow } from "@/lib/audit/index";
import { resendReceiptForOrder } from "@/lib/orders/resend-receipt";
import { releaseCouponUse } from "@/lib/orders/coupon";
import type { ActionResult } from "@/types/api";
import type {
  AdminOrderListItem,
  AdminOrderDetail,
  OrderPaymentEvent,
} from "@/types/order";

const PERMISSION = "orders.read";
const GRANT_PERMISSION = "orders.grant";
const PAGE_SIZE = 20;

// ── Input schemas (validated before requireStaff to fail fast on bad input) ──

const UUID_SCHEMA = z.string().uuid();
const REASON_SCHEMA = z.string().min(1).max(500);
const NOTE_SCHEMA = z.string().min(0).max(500);

const OrdersListFilterSchema = z.object({
  status: z.string().max(50).optional(),
  paymentMethod: z.string().max(50).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  // search: only order-number characters to prevent PostgREST filter injection
  search: z.string().max(50).regex(/^[A-Za-z0-9\s\-_]*$/).optional(),
  needsReview: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
});

// ── getOrdersList (AC1) ───────────────────────────────────────────────────────

export interface OrdersListFilter {
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  needsReview?: boolean;
  page?: number;
}

export interface OrdersListResult {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getOrdersList(
  filter: OrdersListFilter,
): Promise<ActionResult<OrdersListResult>> {
  const parsed = OrdersListFilterSchema.safeParse(filter);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sb = await createSupabaseServiceRoleClient();
  const f = parsed.data;
  const page = f.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb as any)
    .from("orders")
    .select(
      "id, order_number, status, payment_method, total_cents, created_at, needs_review, " +
      "profiles!orders_user_id_fkey(id, first_name, last_name, email)",
      { count: "exact" },
    );

  if (f.status) query = query.eq("status", f.status);
  if (f.paymentMethod) query = query.eq("payment_method", f.paymentMethod);
  if (f.dateFrom) query = query.gte("created_at", f.dateFrom);
  if (f.dateTo) query = query.lte("created_at", f.dateTo);
  if (f.needsReview === true) query = query.eq("needs_review", true);

  if (f.search) {
    // The search value has been validated by OrdersListFilterSchema to match
    // /^[A-Za-z0-9\s\-_]*$/ (max 50 chars), which prevents PostgREST filter
    // injection. Using .or() here is safe given that constraint.
    // Covers order_number, buyer first_name, last_name, and email via GIN index.
    const s = f.search;
    query = query.or(
      `order_number.ilike.%${s}%,` +
      `profiles.first_name.ilike.%${s}%,` +
      `profiles.last_name.ilike.%${s}%,` +
      `profiles.email.ilike.%${s}%`,
    );
  }

  const { data: rows, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { ok: false, code: "unknown" };

  const items: AdminOrderListItem[] = ((rows as Array<Record<string, unknown>>) ?? []).map((r) => {
    const profile = Array.isArray(r["profiles"])
      ? (r["profiles"][0] as Record<string, unknown> | undefined)
      : (r["profiles"] as Record<string, unknown> | null);
    return {
      orderId: String(r["id"] ?? ""),
      orderNumber: String(r["order_number"] ?? ""),
      status: r["status"] as AdminOrderListItem["status"],
      paymentMethod: r["payment_method"] != null ? String(r["payment_method"]) : null,
      totalCents: Number(r["total_cents"] ?? 0),
      createdAt: String(r["created_at"] ?? ""),
      buyerName: profile
        ? `${profile["first_name"] ?? ""} ${profile["last_name"] ?? ""}`.trim()
        : "",
      buyerEmail: profile ? String(profile["email"] ?? "") : "",
      needsReview: Boolean(r["needs_review"]),
    };
    // payment_events are never included — AC1 requirement: never expose raw payload here
  });

  return {
    ok: true,
    data: { items, total: count ?? 0, page, pageSize: PAGE_SIZE },
  };
}

// ── getOrderDetail (AC2) ──────────────────────────────────────────────────────

export async function getOrderDetail(
  orderId: string,
): Promise<ActionResult<AdminOrderDetail>> {
  const idParsed = UUID_SCHEMA.safeParse(orderId);
  if (!idParsed.success) return { ok: false, code: "validation_error" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const isSuperAdmin = auth.user.claimedRole === "super_admin";
  const sb = await createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("orders")
    .select(
      "id, order_number, status, payment_method, total_cents, created_at, " +
      "needs_review, review_reason, " +
      "billing_name, billing_email, billing_phone, billing_company, billing_address, " +
      "coupon_code_snapshot, coupon_type_snapshot, coupon_value_snapshot, " +
      "profiles!orders_user_id_fkey(id, first_name, last_name, email), " +
      "order_items(id, document_id, title_snapshot, language, line_total_cents), " +
      "payment_events(id, received_at, status_code, outcome, payload), " +
      "entitlements(id, language, downloads_used, download_limit, revoked_at), " +
      "bank_transfer_slips(id, uploaded_at, status, reviewer:profiles!reviewer_id_fkey(first_name, last_name), reason)",
    )
    .eq("id", idParsed.data)
    .single();

  if (error || !data) return { ok: false, code: "not_found" };

  const r = data as Record<string, unknown>;
  const profile = Array.isArray(r["profiles"])
    ? (r["profiles"][0] as Record<string, unknown> | undefined)
    : (r["profiles"] as Record<string, unknown> | null);

  const rawEvents = (r["payment_events"] as Array<Record<string, unknown>>) ?? [];
  const paymentEvents: OrderPaymentEvent[] = rawEvents.map((pe) => {
    const event: OrderPaymentEvent = {
      id: String(pe["id"] ?? ""),
      receivedAt: String(pe["received_at"] ?? ""),
      statusCode: Number(pe["status_code"] ?? 0),
      outcome: pe["outcome"] != null ? String(pe["outcome"]) : null,
    };
    if (isSuperAdmin) {
      const raw = pe["payload"] as Record<string, unknown> | null | undefined;
      if (raw != null) {
        // Explicit allowlist — never expose raw JSONB verbatim to avoid leaking any field PayHere may add.
        event.payload = {
          status_code: raw["status_code"],
          amount: raw["amount"],
          currency: raw["currency"],
          order_id: raw["order_id"],
          method: raw["method"],
        } as Record<string, unknown>;
      }
    }
    return event;
  });

  const items = ((r["order_items"] as Array<Record<string, unknown>>) ?? []).map((oi) => ({
    orderItemId: String(oi["id"] ?? ""),
    documentId: String(oi["document_id"] ?? ""),
    titleSnapshot: String(oi["title_snapshot"] ?? ""),
    language: String(oi["language"] ?? ""),
    lineTotalCents: Number(oi["line_total_cents"] ?? 0),
  }));

  const downloads = ((r["entitlements"] as Array<Record<string, unknown>>) ?? []).map((e) => ({
    entitlementId: String(e["id"] ?? ""),
    language: String(e["language"] ?? ""),
    downloadsUsed: Number(e["downloads_used"] ?? 0),
    downloadLimit: Number(e["download_limit"] ?? 0),
    revokedAt: e["revoked_at"] != null ? String(e["revoked_at"]) : null,
  }));

  const bankSlips = ((r["bank_transfer_slips"] as Array<Record<string, unknown>>) ?? []).map((s) => {
    const rev = s["reviewer"] as Record<string, unknown> | null;
    return {
      id: String(s["id"] ?? ""),
      uploadedAt: String(s["uploaded_at"] ?? ""),
      status: String(s["status"] ?? ""),
      reviewer: rev ? `${rev["first_name"] ?? ""} ${rev["last_name"] ?? ""}`.trim() : null,
      reason: s["reason"] != null ? String(s["reason"]) : null,
    };
  });

  const couponCode = r["coupon_code_snapshot"] != null ? String(r["coupon_code_snapshot"]) : null;
  const couponSnapshot = couponCode != null
    ? {
        code: couponCode,
        type: String(r["coupon_type_snapshot"] ?? ""),
        value: Number(r["coupon_value_snapshot"] ?? 0),
      }
    : null;

  const orderStatus = r["status"] as AdminOrderDetail["status"];
  const invoiceUrl = orderStatus === "paid" ? `/api/invoice/${idParsed.data}` : null;

  return {
    ok: true,
    data: {
      orderId: String(r["id"] ?? ""),
      orderNumber: String(r["order_number"] ?? ""),
      status: orderStatus,
      paymentMethod: r["payment_method"] != null ? String(r["payment_method"]) : null,
      totalCents: Number(r["total_cents"] ?? 0),
      createdAt: String(r["created_at"] ?? ""),
      buyerName: profile
        ? `${profile["first_name"] ?? ""} ${profile["last_name"] ?? ""}`.trim()
        : "",
      buyerEmail: profile ? String(profile["email"] ?? "") : "",
      needsReview: Boolean(r["needs_review"]),
      reviewReason: r["review_reason"] != null ? String(r["review_reason"]) : null,
      billingSnapshot: {
        name: r["billing_name"] != null ? String(r["billing_name"]) : null,
        email: r["billing_email"] != null ? String(r["billing_email"]) : null,
        phone: r["billing_phone"] != null ? String(r["billing_phone"]) : null,
        company: r["billing_company"] != null ? String(r["billing_company"]) : null,
        address: r["billing_address"] != null ? (r["billing_address"] as Record<string, unknown>) : null,
      },
      couponSnapshot,
      invoiceUrl,
      items,
      paymentEvents,
      downloads,
      bankSlips,
    },
  };
}

// ── cancelPendingOrder (AC3 + EC1) ────────────────────────────────────────────

export async function cancelPendingOrder(
  orderId: string,
  reason: string,
): Promise<ActionResult<void>> {
  const idParsed = UUID_SCHEMA.safeParse(orderId);
  if (!idParsed.success) return { ok: false, code: "validation_error" };
  const reasonParsed = REASON_SCHEMA.safeParse(reason);
  if (!reasonParsed.success) return { ok: false, code: "validation_error" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sb = await createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("admin_cancel_order", {
    p_order_id: idParsed.data,
    p_reason: reasonParsed.data,
  });

  if (error) return { ok: false, code: "unknown" };

  const action = (data as { action?: string } | null)?.action;

  if (action === "payment_in_progress") return { ok: false, code: "payment_in_progress" };
  if (action === "already_done" || action === "not_found") return { ok: false, code: "not_allowed" };
  if (action !== "cancelled") return { ok: false, code: "unknown" };

  // releaseCouponUse is a no-op for orders with no coupon (R1 stub); safe to call unconditionally.
  // Wrapped in try/catch so a coupon-service failure does not roll back the already-committed cancel.
  try {
    await releaseCouponUse({ id: idParsed.data });
  } catch (err) {
    console.error("releaseCouponUse failed after cancel — coupon slot may need manual release", { orderId: idParsed.data, err });
  }

  await writeAuditRow({
    action: "order.cancel",
    actorId: auth.user.id,
    entityType: "order",
    entityId: idParsed.data,
    after: { reason: reasonParsed.data },
    summary: `Admin cancelled order. Reason: ${reasonParsed.data}`,
  });

  return { ok: true };
}

// ── resolveReview (AC4 + EC4) ─────────────────────────────────────────────────

export async function resolveReview(
  orderId: string,
  note: string,
): Promise<ActionResult<void>> {
  const idParsed = UUID_SCHEMA.safeParse(orderId);
  if (!idParsed.success) return { ok: false, code: "validation_error" };
  const noteParsed = NOTE_SCHEMA.safeParse(note);
  if (!noteParsed.success) return { ok: false, code: "validation_error" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sb = await createSupabaseServiceRoleClient();

  // EC4: no-op if needs_review is already false — the UPDATE affects zero rows; that is fine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("orders")
    .update({ needs_review: false, review_reason: noteParsed.data })
    .eq("id", idParsed.data)
    .eq("needs_review", true);

  if (error) return { ok: false, code: "unknown" };

  await writeAuditRow({
    action: "order.resolve_review",
    actorId: auth.user.id,
    entityType: "order",
    entityId: idParsed.data,
    after: { note: noteParsed.data },
    summary: `Admin resolved review flag. Note: ${noteParsed.data}`,
  });

  return { ok: true };
}

// ── resendOrderEmail (AC5) ────────────────────────────────────────────────────

export async function resendOrderEmail(
  orderId: string,
): Promise<ActionResult<void>> {
  const idParsed = UUID_SCHEMA.safeParse(orderId);
  if (!idParsed.success) return { ok: false, code: "validation_error" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sb = await createSupabaseServiceRoleClient();
  const result = await resendReceiptForOrder(idParsed.data, sb);

  if (!result.ok) return { ok: false, code: "email_failed" };

  await writeAuditRow({
    action: "order.resend_email",
    actorId: auth.user.id,
    entityType: "order",
    entityId: idParsed.data,
    summary: "Admin triggered receipt email resend",
  });

  return { ok: true };
}

// ── grantOrderAccess (AC6 + EC2) ──────────────────────────────────────────────

export async function grantOrderAccess(
  orderId: string,
  reason: string,
): Promise<ActionResult<void>> {
  const idParsed = UUID_SCHEMA.safeParse(orderId);
  if (!idParsed.success) return { ok: false, code: "validation_error" };
  const reasonParsed = REASON_SCHEMA.safeParse(reason);
  if (!reasonParsed.success) return { ok: false, code: "validation_error" };

  const auth = await requireStaff(GRANT_PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const sb = await createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (sb as any)
    .from("orders")
    .select("id, status, user_id, order_items(id, document_id, language)")
    .eq("id", idParsed.data)
    .single();

  if (orderError || !order) return { ok: false, code: "not_found" };

  const r = order as Record<string, unknown>;
  if (r["status"] !== "paid") return { ok: false, code: "not_allowed" };

  const orderItems = (r["order_items"] as Array<Record<string, unknown>>) ?? [];
  if (orderItems.length === 0) {
    // No items to grant — still counts as success (idempotent)
    return { ok: true };
  }

  const entitlements = orderItems.map((item) => ({
    user_id: String(r["user_id"] ?? ""),
    item_type: "document",
    document_id: String(item["document_id"] ?? ""),
    language: String(item["language"] ?? "en"),
    source: "admin_grant",
    granted_by: auth.user.id,
    download_limit: 1,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (sb as any)
    .from("entitlements")
    .insert(entitlements);

  // 23505 = unique_violation: duplicate admin_grant is idempotent, treat as success.
  // The partial unique index (WHERE source = 'admin_grant') enforces uniqueness at the DB level.
  if (insertError && insertError.code !== "23505") return { ok: false, code: "unknown" };

  await writeAuditRow({
    action: "order.grant",
    actorId: auth.user.id,
    entityType: "order",
    entityId: idParsed.data,
    after: { reason: reasonParsed.data, itemCount: orderItems.length },
    summary: `Admin granted access to order. Reason: ${reasonParsed.data}`,
  });

  return { ok: true };
}
