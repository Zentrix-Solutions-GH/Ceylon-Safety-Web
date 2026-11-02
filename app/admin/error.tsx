"use client";

import Link from "next/link";
import { t } from "@/messages/en";

export default function AdminErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t("error.heading")}</h1>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("error.try_again")}
        </button>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {t("nav.home")}
        </Link>
      </div>
    </div>
  );
}
