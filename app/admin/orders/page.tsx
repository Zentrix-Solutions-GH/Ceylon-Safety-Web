// S-103: Admin orders list page — AC1–AC7
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrdersList } from "@/lib/admin/actions/orders";
import { t } from "@/messages/en";
import OrdersListClient from "./OrdersListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${t("admin.orders.page_title")} — CeylonSafety Admin`,
  robots: { index: false, follow: false },
};

type SearchParams = {
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  needsReview?: string;
  page?: string;
};

// AC3: requires orders.read; notFound on not_allowed.
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const rawPage = params.page ? parseInt(params.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const result = await getOrdersList({
    status: params.status,
    paymentMethod: params.paymentMethod,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
    needsReview: params.needsReview === "true" ? true : undefined,
    page,
  });

  if (!result.ok) {
    if (result.code === "not_allowed") notFound();
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">{t("admin.orders.heading")}</h1>
        <p className="text-destructive py-8 text-center">{t("admin.orders.load_error")}</p>
      </div>
    );
  }

  const data = result.data;
  if (!data) notFound();

  // key forces OrdersListClient to remount on every URL change so uncontrolled
  // filter inputs always reflect the current search params.
  const clientKey = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
  ).toString();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{t("admin.orders.heading")}</h1>
      <OrdersListClient
        key={clientKey}
        items={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
      />
    </div>
  );
}
