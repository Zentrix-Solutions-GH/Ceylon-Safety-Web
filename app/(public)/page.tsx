import type { Metadata } from "next";
import { getFeed } from "@/lib/feed/query";
import { getCounters } from "@/lib/counters";
import { Feed } from "@/components/home/Feed";
import { Counters } from "@/components/home/Counters";
import { t } from "@/messages/en";

export const metadata: Metadata = {
  title: t("home.page_title"),
  description: t("home.page_description"),
};

const AUTO_LOAD_UNTIL_PAGE = 3;

export default async function HomePage() {
  const [feedResult, counters] = await Promise.all([getFeed(), getCounters()]);

  const firstPage = feedResult.ok
    ? feedResult.page
    : { items: [], nextCursor: null };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Feed firstPage={firstPage} autoLoadUntilPage={AUTO_LOAD_UNTIL_PAGE} />
      <Counters data={counters} />
    </div>
  );
}
