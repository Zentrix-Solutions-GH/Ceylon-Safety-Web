import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditRow } from "@/lib/audit/index";
import { sendOwnerAlert } from "@/lib/alerts/owner-alert";
import { checkExportRateLimit } from "@/lib/admin/export/csv-rate-limit";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const QuerySchema = z.object({
  from: z.string().regex(ISO_DATE, "ISO date required"),
  to: z.string().regex(ISO_DATE, "ISO date required"),
  include_email: z.enum(["true", "false"]).optional(),
});

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

// Convert an ISO date (YYYY-MM-DD) to UTC equivalents of day-start and day-end
// in Asia/Colombo (UTC+5:30, no DST). Avoids PostgREST timezone-offset parsing
// ambiguity by using plain UTC strings.
// e.g. "2026-11-01" → "2026-10-31T18:30:00Z"  (00:00:00+05:30 in UTC)
// e.g. "2026-11-30" → "2026-11-30T18:29:59Z"  (23:59:59+05:30 in UTC)
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function colomboDayStartUTC(isoDate: string): string {
  const ms = new Date(`${isoDate}T00:00:00Z`).getTime() - COLOMBO_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 19) + "Z";
}
function colomboDayEndUTC(isoDate: string): string {
  const ms = new Date(`${isoDate}T23:59:59Z`).getTime() - COLOMBO_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 19) + "Z";
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

// Quote every cell; escape embedded double-quotes with "".
// Guards against CSV injection (cells starting with =, +, -, @, tab, CR).
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

// Format ISO timestamp as Asia/Colombo date (YYYY-MM-DD HH:MM).
// Asia/Colombo is UTC+5:30 with no DST.
function toColomboDateTime(isoString: string): string {
  const utc = new Date(isoString);
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const local = new Date(utc.getTime() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
}

// Format cents as LKR (e.g. 150000 → "1500.00").
function formatLkr(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface ExportRow {
  order_number: string;
  created_at: string;
  status: string;
  payment_method: string | null;
  total_cents: number;
  profiles: { first_name: string; last_name: string; email: string } | null;
  order_items: Array<{
    title_snapshot: string;
    language: string;
    line_total_cents: number;
  }>;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  // 1. Auth — requires orders.export permission
  const auth = await requireStaff("orders.export");
  if (!auth.ok) {
    const authCodes401 = new Set(["reauth_required", "mfa_required"]);
    const status = authCodes401.has(auth.code) ? 401 : 403;
    return NextResponse.json({ error: auth.code }, { status });
  }

  const { user } = auth;

  // 2. Validate query params
  const { searchParams } = request.nextUrl;
  const rawQuery = Object.fromEntries(searchParams.entries());
  const parsed = QuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { from, to, include_email } = parsed.data;
  const includeEmail = include_email === "true";

  // from ≤ to
  if (new Date(from) > new Date(to)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // range ≤ 366 days
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // include_email allowed only for super_admin
  if (includeEmail && user.claimedRole !== "super_admin") {
    return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  }

  // 3. Rate limit
  const rateLimit = await checkExportRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  // 4. Stream CSV
  const CHUNK_SIZE = 50;
  const db = createSupabaseServiceRoleClient();

  const headers: (string | number | null | undefined)[] = [
    "order_ref", "date", "buyer_name", "document_title", "language",
    "unit_price_lkr", "total_lkr", "payment_method", "status",
  ];
  if (includeEmail) headers.push("email");

  let rowCount = 0;
  let hadDbError = false;
  let auditFired = false;

  // Fires audit log and owner alert exactly once — called from both normal
  // stream completion and the cancel callback (client disconnect).
  function fireAuditAndAlert() {
    if (auditFired) return;
    auditFired = true;

    writeAuditRow({
      action: "order.export",
      actorId: user.id,
      after: { from, to, row_count: rowCount, include_email: includeEmail, ...(hadDbError ? { db_error: true } : {}) },
    }).catch((e: unknown) => {
      console.error("[orders-export] audit write failed:", (e as Error).message);
    });

    sendOwnerAlert("order.csv_export", {
      auditRowId: "0",
      actorName: user.claimedRole === "super_admin" ? `super_admin:${user.id}` : `admin:${user.id}`,
      actorId: user.id,
      changedAt: new Date().toISOString(),
    }).catch((e: unknown) => {
      console.error("[orders-export] owner alert failed:", (e as Error).message);
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      // Header row
      controller.enqueue(enc.encode(csvRow(headers) + "\n"));

      // Paginate in CHUNK_SIZE chunks
      let offset = 0;
      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (db as any)
          .from("orders")
          .select(
            "order_number, created_at, status, payment_method, total_cents, " +
            "profiles!orders_user_id_fkey(first_name, last_name, email), " +
            "order_items(title_snapshot, language, line_total_cents)",
          )
          .eq("status", "paid")
          .gte("created_at", colomboDayStartUTC(from))
          .lte("created_at", colomboDayEndUTC(to))
          .order("created_at", { ascending: true })
          .range(offset, offset + CHUNK_SIZE - 1);

        if (error) {
          hadDbError = true;
          break;
        }
        if (!data || data.length === 0) break;

        for (const order of data as ExportRow[]) {
          const buyerName =
            order.profiles
              ? `${order.profiles.first_name} ${order.profiles.last_name}`.trim()
              : "";
          const buyerEmail = order.profiles?.email ?? "";
          const items = order.order_items ?? [];

          if (items.length === 0) {
            // Order with no items — emit one row with empty item columns
            const cells: (string | number | null | undefined)[] = [
              order.order_number,
              toColomboDateTime(order.created_at),
              buyerName,
              "",
              "",
              "",
              formatLkr(order.total_cents),
              order.payment_method,
              order.status,
            ];
            if (includeEmail) cells.push(buyerEmail);
            controller.enqueue(enc.encode(csvRow(cells) + "\n"));
            rowCount++;
          } else {
            for (const item of items) {
              const cells: (string | number | null | undefined)[] = [
                order.order_number,
                toColomboDateTime(order.created_at),
                buyerName,
                item.title_snapshot,
                item.language,
                formatLkr(item.line_total_cents),
                formatLkr(order.total_cents),
                order.payment_method,
                order.status,
              ];
              if (includeEmail) cells.push(buyerEmail);
              controller.enqueue(enc.encode(csvRow(cells) + "\n"));
              rowCount++;
            }
          }
        }

        if (data.length < CHUNK_SIZE) break;
        offset += CHUNK_SIZE;
      }

      // 5 & 6. Audit log + owner alert (normal completion path)
      fireAuditAndAlert();

      controller.close();
    },

    // Fires when the client disconnects before the stream closes normally.
    cancel() {
      fireAuditAndAlert();
    },
  });

  const filename = `orders-${from}-${to}.csv`;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
