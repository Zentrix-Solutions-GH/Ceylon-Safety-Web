import "server-only";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { payhereConfig } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyNotifySignature, parseNotifyBody } from "@/lib/payhere/verify";
import { parseCentsStrict } from "@/lib/payhere/money";
import { fulfilNotification } from "@/lib/orders/fulfil";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // AC1 step 1: reject oversized body
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body_too_large" }, { status: 400 });
  }

  let raw: string;
  try {
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "body_too_large" }, { status: 400 });
    }
    raw = new TextDecoder().decode(bytes);
  } catch {
    return NextResponse.json({ error: "read_error" }, { status: 400 });
  }

  // AC1 step 1: reject empty/malformed body
  let fields;
  try {
    fields = parseNotifyBody(raw);
  } catch {
    return NextResponse.json({ error: "malformed_body" }, { status: 400 });
  }

  const config = payhereConfig();

  // AC1 step 2: verify signature (constant-time)
  if (!verifyNotifySignature(fields, config.secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // AC1 step 3: merchant id must equal ours (AC14: sandbox/live cross-posting rejected)
  if (fields.merchant_id !== config.merchantId) {
    return NextResponse.json({ error: "merchant_mismatch" }, { status: 400 });
  }

  const sb = createSupabaseAdminClient();

  // AC1 step 4: find order by order_number, unknown → 200 no-op
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("id,user_id,order_number,total_cents,status,expires_at")
    .eq("order_number", fields.order_id)
    .single();

  if (orderErr || !order) {
    // Log order number only — no personal data (AC13)
    console.info(`payhere_notify: unknown order_number=${fields.order_id}`);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // AC1 step 5: store payment event (idempotent insert)
  const eventKey = fields.payment_id
    ? `${fields.payment_id}:${fields.status_code}`
    : crypto.createHash("sha256").update(raw).digest("hex");

  let amountCents: number | null = null;
  try {
    amountCents = parseCentsStrict(fields.payhere_amount);
  } catch {
    // amount parse failure — recorded with null, outcome set to rejected_mismatch below
  }

  const statusCode = parseInt(fields.status_code, 10);
  const signatureValid = true; // we only get here if sig passed

  const { data: insertedEvent, error: insertErr } = await sb
    .from("payment_events")
    .insert({
      order_id: order.id,
      provider: "payhere",
      provider_payment_id: fields.payment_id || null,
      event_key: eventKey,
      status_code: isNaN(statusCode) ? null : statusCode,
      amount_cents: amountCents,
      currency: fields.payhere_currency || null,
      signature_valid: signatureValid,
      raw_payload: null, // AC13: never log raw payload (may contain card text)
      received_at: new Date().toISOString(),
    })
    .select("id,processed_at")
    .single();

  if (insertErr) {
    if (insertErr.code !== "23505") {
      // Non-duplicate error (network, FK, constraint) — do not enter the duplicate path.
      console.error(`payhere_notify: insert_error code=${insertErr.code} order=${order.order_number}`);
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }
    // Duplicate key — event_key already exists; re-read to decide.
    const { data: existing } = await sb
      .from("payment_events")
      .select("id,processed_at")
      .eq("event_key", eventKey)
      .eq("order_id", order.id)
      .single();

    if (existing?.processed_at) {
      // AC2: true repeat — already processed
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    // Earlier attempt failed; we'll continue with the existing event id
    if (existing) {
      return await runFulfilment(sb, order.id, existing.id, fields, amountCents, statusCode, order.total_cents);
    }
    console.error(`payhere_notify: insert_error order=${order.order_number}`);
    return NextResponse.json({ error: "storage_error" }, { status: 500 });
  }

  // AC2: if processed_at already set somehow (race), stop
  if (insertedEvent?.processed_at) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return await runFulfilment(sb, order.id, insertedEvent.id, fields, amountCents, statusCode, order.total_cents);
}

async function runFulfilment(
  sb: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
  eventId: string,
  fields: ReturnType<typeof parseNotifyBody>,
  amountCents: number | null,
  statusCode: number,
  orderTotalCents: number,
): Promise<NextResponse> {
  // AC1 step 6: currency and amount check — only for success (status 2).
  // Pending (0), cancelled (-1), failed (-2), and chargeback (-3) notifications
  // may carry amount=0 or partial amounts; amount mismatch is only meaningful for
  // a successful payment where the actual charged amount must match the order total.
  if (statusCode === 2 && (fields.payhere_currency !== "LKR" || amountCents !== orderTotalCents)) {
    // AC3: mismatch — record outcome and flag the order for review.
    // flag_mismatch_event sets ceylonsafety.nulling_payload = 'true' and performs
    // both UPDATEs in one transaction body, so the append-only trigger is satisfied.
    // (Calling set_config + UPDATE as two separate PostgREST requests would fail
    // because each request runs in its own transaction and the GUC is gone.)
    const { error: flagErr } = await (sb as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc("flag_mismatch_event", { p_event_id: eventId, p_order_id: orderId });
    if (flagErr) {
      console.error(`payhere_notify: flag_mismatch_error order_id=${orderId}`);
      return NextResponse.json({ error: "storage_error" }, { status: 500 });
    }
    console.error(`payhere_notify: amount_mismatch order_id=${orderId}`);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // AC1 step 7: fulfil via locked transaction
  try {
    await fulfilNotification(orderId, {
      eventId,
      statusCode,
      paymentId: fields.payment_id,
      paymentDescription: fields.payment_description,
      amountCents: amountCents,
      currency: fields.payhere_currency,
    }, sb);
  } catch {
    // AC11: transaction failed — leave event unprocessed for S-081 replay
    console.error(`payhere_notify: fulfil_failed order_id=${orderId}`);
    return NextResponse.json({ error: "fulfil_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
