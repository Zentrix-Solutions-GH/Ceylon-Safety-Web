import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageClient } from "@/components/search/SearchPageClient";

export const metadata: Metadata = {
  robots: { index: false },
};

// Static shell — query and scope are read in the browser inside SearchPageClient.
export default function SearchPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10">
      <Suspense>
        <SearchPageClient />
      </Suspense>
    </main>
  );
}
