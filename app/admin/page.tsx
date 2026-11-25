// S-102: Admin Today page — AC1–AC5
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getAdminTodayCached } from "./layout";
import { formatPrice } from "@/lib/utils/price";
import { t } from "@/messages/en";

export const metadata: Metadata = {
  title: `${t("admin.today.page_title")} — CeylonSafety Admin`,
  robots: { index: false, follow: false },
};

// AC4: no caching
export const dynamic = "force-dynamic";

// ─── Error code → plain sentence ──────────────────────────────────────────────

function mapError(code: string): string {
  if (code === "mfa_required") return t("admin.today.error_mfa_required");
  if (code === "reauth_required") return t("admin.today.error_reauth_required");
  if (code === "rate_limited") return t("admin.today.error_rate_limited");
  return t("admin.today.error_generic");
}

// ─── Queue line row ───────────────────────────────────────────────────────────

interface QueueRowProps {
  label: string;
  count: number;
  href: string;
  extra?: ReactNode;
}

function QueueRow({ label, count, href, extra }: QueueRowProps) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{count}</span>
        {extra}
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t("admin.today.view_queue")}
      </Link>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminTodayPage() {
  // ActionResult<AdminTodayResult> success shape: { ok: true } & AdminTodayResult
  // failure shape: { ok: false; code: ErrorCode }
  let errorCode: string | null = null;
  let comments: { count: number; oldestAt: string | null } | undefined;
  let bankSlips: { count: number; oldestAt: string | null; needsSecondApproval: number } | undefined;
  let downloadRequests: { count: number; oldestAt: string | null } | undefined;
  let ordersNeedingReview: { count: number; oldestAt: string | null } | undefined;
  let todayOrders: { count: number; grossCents: number } | undefined;

  try {
    const result = await getAdminTodayCached();
    if (!result.ok) {
      errorCode = result.code;
    } else {
      comments = result.comments;
      bankSlips = result.bankSlips;
      downloadRequests = result.downloadRequests;
      ordersNeedingReview = result.ordersNeedingReview;
      todayOrders = result.todayOrders;
    }
  } catch {
    errorCode = "unknown";
  }

  if (errorCode !== null) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-4 text-2xl font-semibold">{t("admin.today.heading")}</h1>
        <p className="text-destructive">{mapError(errorCode)}</p>
        <Link
          href="/admin"
          className="mt-3 inline-flex items-center text-sm underline underline-offset-4 hover:text-primary"
        >
          {t("admin.today.retry")}
        </Link>
      </div>
    );
  }

  // todayOrders is a summary row, not an actionable queue item — exclude it
  // from hasLines so the empty state fires when queues are clear but orders exist.
  const hasLines =
    comments != null ||
    bankSlips != null ||
    downloadRequests != null ||
    ordersNeedingReview != null;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">{t("admin.today.heading")}</h1>

      {!hasLines && (
        <p className="text-muted-foreground">{t("admin.today.empty")}</p>
      )}

      <ul>
          {comments != null && (
            <QueueRow
              label={t("admin.today.comments_label")}
              count={comments.count}
              href="/admin/comments"
            />
          )}

          {bankSlips != null && (
            <QueueRow
              label={t("admin.today.bank_slips_label")}
              count={bankSlips.count}
              href="/admin/bank-transfers"
              extra={
                bankSlips.needsSecondApproval > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {bankSlips.needsSecondApproval}{" "}
                    {t("admin.today.bank_slips_second_approval")}
                  </span>
                ) : undefined
              }
            />
          )}

          {downloadRequests != null && (
            <QueueRow
              label={t("admin.today.download_requests_label")}
              count={downloadRequests.count}
              href="/admin/download-requests"
            />
          )}

          {ordersNeedingReview != null && (
            <QueueRow
              label={t("admin.today.orders_review_label")}
              count={ordersNeedingReview.count}
              href="/admin/orders"
            />
          )}

          {todayOrders != null && (
            <li className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t("admin.today.today_orders_label")}</span>
                <span className="text-2xl font-bold tabular-nums">
                  {todayOrders.count}
                </span>
                <span className="text-sm text-muted-foreground">
                  LKR {formatPrice(todayOrders.grossCents)}
                </span>
              </div>
              <Link
                href="/admin/orders"
                className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {t("admin.today.view_queue")}
              </Link>
            </li>
          )}
        </ul>
    </div>
  );
}
