import "server-only";

import { z } from "zod";

import { requireActiveAccount } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/api";
import type { MyOrder } from "@/types/order";

// AC7: fetch an order with its items and entitlement ids for the authenticated owner.
// Another user's order returns not_found (never 403 — avoids leaking order existence).
export async function getMyOrder(orderId: string): Promise<ActionResult<MyOrder>> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { ok: false, code: "validation_failed" };
  }

  const auth = await requireActiveAccount();
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const userId = auth.user.id;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      total_cents,
      created_at,
      order_items (
        id,
        document_id,
        title_snapshot,
        language,
        line_total_cents,
        entitlements ( id )
      )
    `)
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { ok: false, code: "not_found" };
  }

  const items = (data.order_items ?? []).map((item: {
    id: string;
    document_id: string | null;
    title_snapshot: string;
    language: string | null;
    line_total_cents: number;
    entitlements: Array<{ id: string }> | null;
  }) => ({
    orderItemId: item.id,
    documentId: item.document_id ?? "",
    titleSnapshot: item.title_snapshot,
    language: (item.language ?? "en") as MyOrder["items"][number]["language"],
    lineTotalCents: item.line_total_cents,
    entitlementId: item.entitlements?.[0]?.id ?? null,
  }));

  return {
    ok: true,
    data: {
      orderId: data.id,
      orderNumber: data.order_number,
      status: data.status as MyOrder["status"],
      totalCents: data.total_cents,
      createdAt: data.created_at,
      items,
    },
  };
}
