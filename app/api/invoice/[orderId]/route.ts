import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireStaff } from "@/lib/auth/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { r2Config } from "@/lib/config";
import { getObjectBytes } from "@/lib/r2/storage";

const orderIdSchema = z.string().uuid();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const { orderId } = await params;

  const parsed = orderIdSchema.safeParse(orderId);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
  }

  // Try staff first (staff can download any order's invoice).
  const staffResult = await requireStaff("orders.read");
  if (staffResult.ok) {
    return serveInvoiceForStaff(orderId);
  }

  // Fall back to customer — must own the order.
  const userResult = await requireUser();
  if (!userResult.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return serveInvoiceForOwner(orderId, userResult.user.id);
}

async function serveInvoiceForOwner(orderId: string, userId: string): Promise<NextResponse> {
  const sb = await createSupabaseServerClient();

  // Verify order ownership FIRST — non-owners must never learn whether an order exists (AC7, EC6).
  const { data: order } = await sb
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Order belongs to this user — now check for the invoice.
  const { data } = await sb
    .from("invoices")
    .select("id, pdf_key")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!data || !data.pdf_key) {
    return NextResponse.json({ status: "being_prepared" }, { status: 202 });
  }

  return streamPdf(data.pdf_key);
}

async function serveInvoiceForStaff(orderId: string): Promise<NextResponse> {
  const sb = createSupabaseServiceRoleClient();

  const { data, error } = await sb
    .from("invoices")
    .select("id, pdf_key")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ status: "being_prepared" }, { status: 202 });
  }

  if (!data.pdf_key) {
    return NextResponse.json({ status: "being_prepared" }, { status: 202 });
  }

  return streamPdf(data.pdf_key);
}

async function streamPdf(pdfKey: string): Promise<NextResponse> {
  const cfg = r2Config();
  if (!cfg) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  const bytes = await getObjectBytes(cfg.bucketPrivate, pdfKey, 10 * 1024 * 1024);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="invoice.pdf"`,
    },
  });
}
