// AC8: real 404 page — noindex, links to Home/Articles/Courses/Contact Coach.
// Next.js App Router returns HTTP 404 automatically for not-found.tsx.
import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/messages/en";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">{t("not_found.heading")}</h1>
      <p className="text-muted-foreground">{t("not_found.description")}</p>

      <nav aria-label="Helpful links" className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {t("nav.home")}
        </Link>
        <Link href="/articles" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          {t("nav.articles")}
        </Link>
        <Link href="/courses" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          {t("nav.courses")}
        </Link>
        <Link href="/contact-coach" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          {t("nav.contact_coach")}
        </Link>
      </nav>
    </div>
  );
}
