import Link from "next/link";
import { t } from "@/messages/en";

interface Props {
  searchParams: Promise<{ order?: string }>;
}

export default async function CheckoutPendingPage({ searchParams }: Props) {
  const { order } = await searchParams;

  return (
    <main>
      <h1>{t("checkout.pending.title")}</h1>
      <p>{t("checkout.pending.message", { orderNumber: order ?? "—" })}</p>
      <Link href="/purchases">{t("checkout.pending.purchases_link")}</Link>
    </main>
  );
}
