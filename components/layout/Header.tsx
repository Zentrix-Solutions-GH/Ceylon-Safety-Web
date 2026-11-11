// AC2: server component — reads public site_settings (no session) for the announcement bar.
// Session is read in HeaderPersonal (browser client component) only.
import Link from "next/link";
import Image from "next/image";
import { HeaderNav } from "./HeaderNav";
import { HeaderPersonal } from "./HeaderPersonal";
import { t } from "@/messages/en";
import { getAnnouncementBanner } from "@/lib/settings/announcement";

export default async function Header() {
  const banner = await getAnnouncementBanner();

  return (
    <div className="sticky top-0 z-40 w-full">
      {/* Announcement bar — content driven by site_settings (announcement_* keys) */}
      {banner.enabled && (
        <div className="bg-[#C00000] text-white text-xs text-center py-1.5 px-4">
          {banner.text}&nbsp;
          <Link href={banner.linkHref} className="font-semibold underline hover:no-underline whitespace-nowrap">
            {banner.linkLabel} →
          </Link>
        </div>
      )}

      {/* Main nav */}
      <header className="w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-sm">
        <div className="container flex h-12 items-center px-4">
          {/* Logo + wordmark */}
          <Link
            href="/"
            aria-label={t("nav.home_link_label")}
            className="shrink-0 flex items-center gap-2.5"
          >
            <Image
              src="/logo.jpg"
              alt="Ceylon Safety"
              width={32}
              height={32}
              className="rounded"
              priority
            />
            <div className="hidden sm:block">
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-[15px] font-extrabold text-gray-800 tracking-wide">CEYLON</span>
                <span className="text-[15px] font-extrabold text-[#C00000] tracking-wide">SAFETY</span>
              </div>
              <p className="text-[7px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">
                Sri Lanka&apos;s National Safety Hub
              </p>
            </div>
          </Link>

          {/* Desktop nav — centered */}
          <div className="flex-1 flex justify-center">
            <HeaderNav />
          </div>

          {/* Auth state (client component, never on server) */}
          <HeaderPersonal />
        </div>
      </header>
    </div>
  );
}
