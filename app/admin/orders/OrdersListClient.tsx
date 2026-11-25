"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/messages/en";
import { formatPrice } from "@/lib/utils/price";
import type { AdminOrderListItem, OrderStatus } from "@/types/order";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrdersListClientProps {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SL_TZ = "Asia/Colombo";

function formatSriLankaDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-LK", {
      timeZone: SL_TZ,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending: t("admin.orders.status.pending"),
    pending_verification: t("admin.orders.status.pending_verification"),
    paid: t("admin.orders.status.paid"),
    failed: t("admin.orders.status.failed"),
    cancelled: t("admin.orders.status.cancelled"),
    refunded: t("admin.orders.status.refunded"),
  };
  return map[status] ?? status;
}

function methodLabel(method: string | null): string {
  if (!method) return t("admin.orders.method.unknown");
  if (method === "card") return t("admin.orders.method.card");
  if (method === "bank_transfer") return t("admin.orders.method.bank_transfer");
  return t("admin.orders.method.unknown");
}

const STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "pending_verification",
  "paid",
  "failed",
  "cancelled",
  "refunded",
];

const METHOD_OPTIONS = ["card", "bank_transfer"] as const;

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

function Pagination({ page, total, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav aria-label={t("admin.orders.pagination_label")} className="mt-4 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("admin.orders.page_prev")}
        className="rounded border px-3 py-1 text-sm disabled:opacity-40"
      >
        {t("admin.orders.page_prev")}
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={[
            "rounded border px-3 py-1 text-sm",
            p === page ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted",
          ].join(" ")}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t("admin.orders.page_next")}
        className="rounded border px-3 py-1 text-sm disabled:opacity-40"
      >
        {t("admin.orders.page_next")}
      </button>
    </nav>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrdersListClient({
  items,
  total,
  page,
  pageSize,
}: OrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "") {
        sp.delete(k);
      } else {
        sp.set(k, v);
      }
    }
    sp.delete("page"); // reset to page 1 on filter change
    router.push(`/admin/orders?${sp.toString()}`);
  }

  function handlePageChange(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    router.push(`/admin/orders?${sp.toString()}`);
  }

  const currentStatus = searchParams.get("status") ?? "";
  const currentMethod = searchParams.get("paymentMethod") ?? "";
  const currentNeedsReview = searchParams.get("needsReview") === "true";
  const currentSearch = searchParams.get("search") ?? "";
  const currentFrom = searchParams.get("dateFrom") ?? "";
  const currentTo = searchParams.get("dateTo") ?? "";

  return (
    <div>
      {/* ── Filters ────────────────────────────────────────────────────── */}
      <form
        className="mb-4 flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          navigate({
            status: fd.get("status") as string | undefined,
            paymentMethod: fd.get("paymentMethod") as string | undefined,
            needsReview: fd.get("needsReview") === "on" ? "true" : undefined,
            search: fd.get("search") as string | undefined,
            dateFrom: fd.get("dateFrom") as string | undefined,
            dateTo: fd.get("dateTo") as string | undefined,
          });
        }}
      >
        {/* Status */}
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("admin.orders.filter.status_label")}</span>
          <select
            name="status"
            aria-label={t("admin.orders.filter.status_label")}
            defaultValue={currentStatus}
            className="rounded border px-2 py-1 text-sm bg-background"
          >
            <option value="">{t("admin.orders.filter.status_all")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </label>

        {/* Payment method */}
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("admin.orders.filter.method_label")}</span>
          <select
            name="paymentMethod"
            aria-label={t("admin.orders.filter.method_label")}
            defaultValue={currentMethod}
            className="rounded border px-2 py-1 text-sm bg-background"
          >
            <option value="">{t("admin.orders.filter.method_all")}</option>
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>{methodLabel(m)}</option>
            ))}
          </select>
        </label>

        {/* Date from */}
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("admin.orders.filter.date_from")}</span>
          <input
            type="date"
            name="dateFrom"
            aria-label={t("admin.orders.filter.date_from")}
            defaultValue={currentFrom}
            className="rounded border px-2 py-1 text-sm bg-background"
          />
        </label>

        {/* Date to */}
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("admin.orders.filter.date_to")}</span>
          <input
            type="date"
            name="dateTo"
            aria-label={t("admin.orders.filter.date_to")}
            defaultValue={currentTo}
            className="rounded border px-2 py-1 text-sm bg-background"
          />
        </label>

        {/* Search */}
        <label className="flex flex-col gap-1 text-sm">
          <span>{t("admin.orders.filter.search_label")}</span>
          <input
            type="search"
            name="search"
            aria-label={t("admin.orders.filter.search_label")}
            defaultValue={currentSearch}
            placeholder={t("admin.orders.filter.search_placeholder")}
            className="rounded border px-2 py-1 text-sm bg-background"
          />
        </label>

        {/* Needs review */}
        <label className="flex items-center gap-2 text-sm self-end pb-1">
          <input
            type="checkbox"
            name="needsReview"
            aria-label={t("admin.orders.filter.needs_review")}
            defaultChecked={currentNeedsReview}
          />
          <span>{t("admin.orders.filter.needs_review")}</span>
        </label>

        <button
          type="submit"
          className="self-end rounded border px-3 py-1 text-sm hover:bg-muted"
        >
          {t("admin.orders.filter.apply")}
        </button>
      </form>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{t("admin.orders.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{t("admin.orders.col.order_number")}</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{t("admin.orders.col.date")}</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{t("admin.orders.col.buyer")}</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{t("admin.orders.col.total")}</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{t("admin.orders.col.method")}</th>
                <th className="py-2 pr-4 font-medium whitespace-nowrap">{t("admin.orders.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.orderId}
                  aria-label={item.orderNumber}
                  onClick={() => router.push(`/admin/orders/${item.orderId}`)}
                  className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/admin/orders/${item.orderId}`);
                    }
                  }}
                >
                  <td className="py-2 pr-4 font-mono whitespace-nowrap">{item.orderNumber}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatSriLankaDateTime(item.createdAt)}</td>
                  <td className="py-2 pr-4">
                    {item.buyerName.trim() !== ""
                      ? item.buyerName
                      : t("admin.orders.deleted_user")}
                  </td>
                  <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{formatPrice(item.totalCents)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{methodLabel(item.paymentMethod)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{statusLabel(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
