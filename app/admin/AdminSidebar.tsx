"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { t } from "@/messages/en";
import type { MessageKey } from "@/messages/en";
import { PERMISSION_MAP } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/auth";
import type { AdminBadgeCounts } from "./AdminShell";

// ─── Permission helpers ───────────────────────────────────────────────────────

function hasPermission(role: UserRole, permission: string): boolean {
  if (role === "super_admin") return true;
  const list: readonly string[] = PERMISSION_MAP[role] ?? [];
  return list.some((p) => {
    if (p.endsWith(".*")) {
      return permission.startsWith(p.slice(0, -2));
    }
    return p === permission;
  });
}

// ─── Menu structure (admin-panel-design section 3.3) ─────────────────────────

const BADGE_ARIA: Record<keyof AdminBadgeCounts, MessageKey> = {
  comments: "admin.badge.comments_aria",
  bankTransfers: "admin.badge.bank_transfers_aria",
  downloadRequests: "admin.badge.download_requests_aria",
};

interface NavItem {
  label: string;
  href: string;
  permission?: string;
  badge?: keyof AdminBadgeCounts;
}

interface NavGroup {
  label: string;
  permission?: string; // group visible only when role has this permission
  superAdminOnly?: boolean;
  items: NavItem[];
}

function buildGroups(): NavGroup[] {
  return [
    {
      label: t("admin.nav.today"),
      items: [{ label: t("admin.nav.today"), href: "/admin/dashboard" }],
    },
    {
      label: t("admin.nav.work_queues"),
      items: [
        { label: t("admin.nav.comments"), href: "/admin/comments", permission: "comments.moderate", badge: "comments" },
        { label: t("admin.nav.bank_transfers"), href: "/admin/bank-transfers", permission: "bank_transfers.review", badge: "bankTransfers" },
        { label: t("admin.nav.download_requests"), href: "/admin/download-requests", permission: "download_requests.review", badge: "downloadRequests" },
      ],
    },
    {
      label: t("admin.nav.content"),
      permission: "articles.*",
      items: [
        { label: t("admin.nav.articles"), href: "/admin/articles", permission: "articles.*" },
        { label: t("admin.nav.videos"), href: "/admin/videos", permission: "videos.*" },
        { label: t("admin.nav.authors"), href: "/admin/authors", permission: "authors.*" },
      ],
    },
    {
      label: t("admin.nav.shop"),
      permission: "documents.*",
      items: [
        { label: t("admin.nav.documents"), href: "/admin/documents", permission: "documents.*" },
        { label: t("admin.nav.orders"), href: "/admin/orders", permission: "orders.read" },
      ],
    },
    {
      label: t("admin.nav.site"),
      permission: "banners.read",
      items: [
        { label: t("admin.nav.banners"), href: "/admin/banners", permission: "banners.read" },
        { label: t("admin.nav.pages"), href: "/admin/pages", permission: "pages.publish" },
      ],
    },
    {
      label: t("admin.nav.people"),
      permission: "users.read",
      items: [
        { label: t("admin.nav.users"), href: "/admin/users", permission: "users.read" },
      ],
    },
    {
      label: t("admin.nav.insights"),
      permission: "orders.export",
      items: [
        { label: t("admin.nav.orders_export"), href: "/admin/reports", permission: "orders.export" },
      ],
    },
    {
      label: t("admin.nav.settings"),
      permission: "settings.site",
      items: [
        { label: t("admin.nav.settings"), href: "/admin/settings", permission: "settings.site" },
      ],
    },
    {
      label: t("admin.nav.records"),
      permission: "email_logs.read",
      items: [
        { label: t("admin.nav.email_log"), href: "/admin/email-logs", permission: "email_logs.read" },
      ],
    },
    {
      label: t("admin.nav.staff"),
      superAdminOnly: true,
      items: [
        { label: t("admin.nav.staff"), href: "/admin/staff" },
        { label: t("admin.nav.audit_log"), href: "/admin/audit-log" },
        { label: t("admin.nav.permissions"), href: "/admin/permissions" },
        { label: t("admin.nav.system"), href: "/admin/system" },
      ],
    },
    {
      label: t("admin.nav.me"),
      items: [
        { label: t("admin.nav.my_security"), href: "/admin/security" },
      ],
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminSidebarProps {
  role: UserRole;
  badgeCounts: AdminBadgeCounts | null;
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ role, badgeCounts, open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  // buildGroups() calls t() which returns static strings — memoize to avoid rebuilding the array on every render.
  const groups = useMemo(() => buildGroups(), []);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <nav
        id="admin-sidebar"
        aria-label="Admin navigation"
        className={[
          "fixed inset-y-0 left-0 z-30 w-56 flex-col border-r bg-background overflow-y-auto",
          "flex md:static md:flex",
          open ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <div className="flex h-14 items-center border-b px-4">
          <span className="font-semibold text-sm">CeylonSafety Admin</span>
        </div>

        <ul className="flex-1 py-2" role="list">
          {groups.map((group) => {
            // Super Admin only groups
            if (group.superAdminOnly && role !== "super_admin") return null;

            // Groups gated by a single permission
            if (group.permission && !hasPermission(role, group.permission)) return null;

            // Work queues group: show only if user has at least one item
            const visibleItems = group.items.filter(
              (item) => !item.permission || hasPermission(role, item.permission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <li key={group.label}>
                <p className="px-4 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </p>
                <ul role="list">
                  {visibleItems.map((item) => {
                    const count = item.badge ? (badgeCounts?.[item.badge] ?? 0) : 0;
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={[
                            "flex items-center justify-between px-4 py-1.5 text-sm rounded-sm mx-2",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted",
                          ].join(" ")}
                        >
                          <span>{item.label}</span>
                          {count > 0 && (
                            <span
                              aria-label={`${count} ${item.badge ? t(BADGE_ARIA[item.badge]) : ""}`}
                              className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
                            >
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
