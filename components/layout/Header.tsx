// AC2: server component — never calls cookies(), headers(), or the server Supabase client.
// Session is read in HeaderPersonal (browser client component) only.
import Link from "next/link";
import { HeaderNav } from "./HeaderNav";
import { HeaderPersonal } from "./HeaderPersonal";
import { t } from "@/messages/en";

export default function Header() {
  return (
    // ASSUMPTION (frontend 10): sticky header; scroll-padding-top keeps anchors visible.
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-4 px-4">
        {/* EC6: text wordmark — logo image pending Q47. */}
        <Link
          href="/"
          aria-label={t("nav.home_link_label")}
          className="mr-4 text-lg font-bold text-primary shrink-0"
        >
          {t("site.wordmark")}
        </Link>

        {/* Desktop nav and mobile hamburger */}
        <div className="flex-1">
          <HeaderNav />
        </div>

        {/* Cart + auth state (client component, never on server) */}
        <HeaderPersonal />
      </div>
    </header>
  );
}
