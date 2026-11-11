"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/config/navigation";
import { t } from "@/messages/en";

// AC5: Radix Sheet handles focus trap, Escape-to-close, and page inert via Dialog primitive.
export function HeaderNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // EC4: close the sheet when the viewport widens to desktop.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setIsOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      {/* Desktop nav — hidden below lg */}
      <nav aria-label="Site navigation" className="hidden lg:flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative text-sm font-medium transition-colors pb-1 ${
                isActive
                  ? "text-[#C00000] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#C00000] after:rounded-full"
                  : "text-gray-700 hover:text-[#C00000]"
              }`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Mobile hamburger — visible below lg */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {/* AC5: SheetTrigger tracks this button so Radix returns focus to it on close. */}
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={t("nav.open_menu")}
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-md hover:bg-accent"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </SheetTrigger>

        {/* AC5: SheetContent is a Radix Dialog — focus moves in, Escape closes, page is inert. */}
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="sr-only">{t("nav.mobile_nav_title")}</SheetTitle>
          </SheetHeader>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1 mt-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setIsOpen(false)}
                className="flex items-center px-3 py-3 min-h-[44px] rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
