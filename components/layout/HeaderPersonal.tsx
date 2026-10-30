"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { t, errorMessage } from "@/messages/en";

// AC2: personal parts are a client component; Header never reads the session on the server.
export function HeaderPersonal() {
  const { user, isLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSigningOut = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Auto-focus first menuitem when dropdown opens (WAI-ARIA menu keyboard pattern).
  useEffect(() => {
    if (!menuOpen) return;
    const first = dropdownRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, [menuOpen]);

  // Returns true when the menu actually closes; false when sign-out is in-flight.
  function closeMenu(): boolean {
    if (isSigningOut.current) return false;
    setMenuOpen(false);
    return true;
  }

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      dropdownRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (closeMenu()) menuButtonRef.current?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (closeMenu()) menuButtonRef.current?.focus();
    }
  }

  function handleMenuToggle() {
    if (isSigningOut.current) return;
    if (!menuOpen) setSignOutError(null);
    setMenuOpen((prev) => !prev);
  }

  async function handleSignOut() {
    setSignOutError(null);
    isSigningOut.current = true;
    try {
      await signOut();
      if (isMounted.current) setMenuOpen(false);
    } catch {
      // EC5: sign out fails — show error inside open menu; user stays signed in.
      if (isMounted.current) setSignOutError(errorMessage("unknown"));
    } finally {
      isSigningOut.current = false;
    }
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
      </Link>

      {/* AC2: fixed-size placeholder while the session is not yet known. */}
      {isLoading && (
        <div
          aria-busy="true"
          aria-label={t("nav.loading_account")}
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
        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleMenuToggle}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={menuOpen ? "account-menu" : undefined}
            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
          >
            {/* EC3: truncate long names so they never break the header layout at 375 px. */}
            <span className="truncate max-w-[8rem]">{user.name ?? t("nav.account")}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 z-50">
              <div
                id="account-menu"
                ref={dropdownRef}
                role="menu"
                aria-label={t("nav.account")}
                onKeyDown={handleMenuKeyDown}
                className="w-44 rounded-md border bg-popover shadow-md py-1"
              >
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm hover:bg-accent"
                >
                  {t("nav.profile")}
                </Link>
                <Link
                  href="/purchases"
                  role="menuitem"
                  onClick={closeMenu}
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
              {signOutError && (
                <p role="alert" className="mt-1 text-xs text-destructive whitespace-nowrap px-1">
                  {signOutError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
