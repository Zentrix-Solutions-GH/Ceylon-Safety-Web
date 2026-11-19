import type { Metadata } from "next";
import { Suspense } from "react";
import { getFeed } from "@/lib/feed/query";
import { getCounters } from "@/lib/counters";
import { Feed } from "@/components/home/Feed";
import { Counters } from "@/components/home/Counters";
import { HeroSection } from "@/components/home/HeroSection";
import { SafetyDomains } from "@/components/home/SafetyDomains";
import { PopularDocumentsGrid } from "@/components/home/PopularDocuments";
import { listPublicDocuments } from "@/lib/documents/public";
import { TrainerCTA } from "@/components/home/TrainerCTA";
import { VideoModalLoader } from "@/components/videos/VideoModalLoader";
import { SideAdColumn } from "@/components/ads/SideAdColumn";
import { publicConfig } from "@/lib/config.public";
import { t } from "@/messages/en";

export const metadata: Metadata = {
  title: t("home.page_title"),
  description: t("home.page_description"),
  // Canonical stays / even when ?video=<id> is in the address (AC2)
  alternates: { canonical: publicConfig.appUrl },
};

const AUTO_LOAD_UNTIL_PAGE = 3;

export default async function HomePage() {
  const [feedResult, counters, docsResult] = await Promise.all([
    getFeed().catch((err) => { console.error("[HomePage] feed error", err); return { ok: false as const, page: undefined }; }),
    getCounters().catch((err) => { console.error("[HomePage] counters error", err); return { articles: null, documents: null, users: null, downloads: null }; }),
    listPublicDocuments({ sort: "popular", page: 1 }).catch(() => ({ ok: false as const, code: "unknown" as const, reason: "fetch failed" })),
  ]);

  const firstPage = feedResult.ok
    ? feedResult.page
    : { items: [], nextCursor: null };

  return (
    <>
      <HeroSection />
      {/* pt-8 compensates for the search bar that overflows the hero by ~50% of its height */}
      <div className="pt-8">
        {docsResult.ok && docsResult.data.documents.length > 0 && (
          <PopularDocumentsGrid docs={docsResult.data.documents.slice(0, 4)} />
        )}
        <SafetyDomains />
      </div>

      {/* Latest Today — 3-column layout: left ad | feed | right ad (lg+) */}
      <div className="bg-white py-10">
        <div className="mx-auto max-w-screen-2xl px-4">
          <div className="flex items-start justify-center gap-6">

            {/* Left ad column — hidden below xl (1280px); advertising design section 5 */}
            <aside className="hidden xl:block w-[160px] shrink-0" aria-label="Advertisement">
              <SideAdColumn side="left" />
            </aside>

            {/* Main content */}
            <div className="min-w-0 w-full max-w-3xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{t("home.latest.heading")}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{t("home.latest.description")}</p>
                </div>
                <Counters data={counters} />
              </div>
              <Feed firstPage={firstPage} autoLoadUntilPage={AUTO_LOAD_UNTIL_PAGE} />
            </div>

            {/* Right ad column — hidden below xl (1280px); advertising design section 5 */}
            <aside className="hidden xl:block w-[160px] shrink-0" aria-label="Advertisement">
              <SideAdColumn side="right" />
            </aside>

          </div>
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
