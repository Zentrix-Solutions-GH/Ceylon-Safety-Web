import type { ReactNode } from "react";
import Link from "next/link";
import { t } from "@/messages/en";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="flex justify-center">
          <Link
            href="/"
            aria-label={t("nav.home_link_label")}
            className="text-2xl font-bold text-primary"
          >
            {t("site.wordmark")}
          </Link>
        </header>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
