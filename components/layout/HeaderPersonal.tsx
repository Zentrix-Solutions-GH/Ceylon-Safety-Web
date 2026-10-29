"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { t, errorMessage } from "@/messages/en";

// AC2: personal parts are a client component; Header never reads the session on the server.
export function HeaderPersonal() {
  const { user, isLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      // EC5: sign out fails — show the unknown message; user stays signed in.
      setSignOutError(errorMessage("unknown"));
    }
    setMenuOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      {/* AC4: cart link — middleware redirects unsigned-in visitors from /cart to /sign-in. */}
      <Link
        href="/cart"
        aria-label={t("nav.cart")}
        className="flex items-center justify-center w-11 h-11 rounded-md hover:bg-accent relative"
      >
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        {/* Fixed-width badge slot — count filled by S-091. */}
        <span className="sr-only">{t("nav.cart")}</span>
      </Link>

      {/* AC2: fixed-size placeholder while the session is not yet known. */}
      {isLoading && (
        <div
          aria-busy="true"
          aria-label="Loading account"
          className="w-20 h-9 rounded-md bg-muted animate-pulse"
        />
      )}

      {/* AC3: signed-out state */}
      {!isLoading && !user && (
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="text-sm font-medium px-3 py-2 rounded-md hover:bg-accent"
          >
            {t("nav.sign_in")}
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("nav.sign_up")}
          </Link>
        </div>
      )}

      {/* AC3: signed-in state with account dropdown */}
      {!isLoading && user && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
          >
            {/* EC3: truncate long names so they never break the header layout at 375 px. */}
            <span className="truncate max-w-[8rem]">{user.name ?? t("nav.account")}</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-44 rounded-md border bg-popover shadow-md z-50 py-1"
            >
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-accent"
              >
                {t("nav.profile")}
              </Link>
              <Link
                href="/purchases"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-accent"
              >
                {t("nav.my_purchases")}
              </Link>
              <hr className="my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent"
              >
                {t("nav.sign_out")}
              </button>
            </div>
          )}

          {signOutError && (
            <p role="alert" className="absolute right-0 mt-1 text-xs text-destructive whitespace-nowrap">
              {signOutError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
