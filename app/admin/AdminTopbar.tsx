"use client";

import { useTransition } from "react";
import { t } from "@/messages/en";
import type { MessageKey } from "@/messages/en";
import { signOut } from "@/lib/auth/actions/sign-out";
import type { UserRole } from "@/types/auth";

const ROLE_LABELS: Record<UserRole, MessageKey> = {
  super_admin: "admin.role.super_admin",
  admin: "admin.role.admin",
  editor: "admin.role.editor",
};

interface AdminTopbarProps {
  displayName: string;
  email: string;
  role: UserRole;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function AdminTopbar({
  displayName,
  email,
  role,
  onToggleSidebar,
  sidebarOpen,
}: AdminTopbarProps) {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut({ scope: "this" });
    });
  }

  const toggleLabel = sidebarOpen
    ? t("admin.sidebar.toggle_close")
    : t("admin.sidebar.toggle_open");

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={sidebarOpen}
        aria-controls="admin-sidebar"
        onClick={onToggleSidebar}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
      >
        {/* Hamburger icon */}
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="ml-auto flex items-center gap-4">
        <div className="text-right">
          <p className="max-w-[12rem] truncate text-sm font-medium leading-none">{displayName || email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(ROLE_LABELS[role])}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={pending}
          aria-busy={pending}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {t("admin.nav.sign_out")}
        </button>
      </div>
    </header>
  );
}
