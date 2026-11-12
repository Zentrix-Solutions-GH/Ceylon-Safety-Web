import type { Metadata } from "next";
import { Suspense } from "react";
import { getFeed } from "@/lib/feed/query";
import { getCounters } from "@/lib/counters";
import { Feed } from "@/components/home/Feed";
import { Counters } from "@/components/home/Counters";
import { HeroSection } from "@/components/home/HeroSection";
import { SafetyDomains } from "@/components/home/SafetyDomains";
import { PopularDocuments } from "@/components/home/PopularDocuments";
import { TrainerCTA } from "@/components/home/TrainerCTA";
import { VideoModalLoader } from "@/components/videos/VideoModalLoader";
import { t } from "@/messages/en";

export const metadata: Metadata = {
  title: t("home.page_title"),
  description: t("home.page_description"),
};

const AUTO_LOAD_UNTIL_PAGE = 3;

export default async function HomePage() {
  const [feedResult, counters] = await Promise.all([
    getFeed().catch((err) => { console.error("[HomePage] feed error", err); return { ok: false as const, page: undefined }; }),
    getCounters().catch((err) => { console.error("[HomePage] counters error", err); return { articles: null, documents: null, users: null, downloads: null }; }),
  ]);

  const firstPage = feedResult.ok
    ? feedResult.page
    : { items: [], nextCursor: null };

  return (
    <>
      <HeroSection />
      {/* pt-8 compensates for the search bar that overflows the hero by ~50% of its height */}
      <div className="pt-8">
        <PopularDocuments />
        <SafetyDomains />
      </div>

      {/* Latest Today */}
      <div className="bg-white py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t("home.latest.heading")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("home.latest.description")}</p>
            </div>
            <Counters data={counters} />
          </div>
          <Feed firstPage={firstPage} autoLoadUntilPage={AUTO_LOAD_UNTIL_PAGE} />
        </div>
      </div>

      <TrainerCTA />

      {/* Video popup — reads useSearchParams inside Suspense so the page stays cached (AC2) */}
      <Suspense fallback={null}>
        <VideoModalLoader />
      </Suspense>
    </>
  );
}
