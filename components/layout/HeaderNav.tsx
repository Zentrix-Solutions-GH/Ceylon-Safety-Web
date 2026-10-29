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
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      {/* Mobile hamburger — visible below lg */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <button
          type="button"
          aria-label={t("nav.open_menu")}
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
          className="lg:hidden flex items-center justify-center w-11 h-11 rounded-md hover:bg-accent"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* AC5: SheetContent is a Radix Dialog — focus moves in, Escape closes, page is inert. */}
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="sr-only">{t("nav.open_menu")}</SheetTitle>
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
