"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "@/types/auth";
import type { AdminBadgeCounts } from "@/types/api";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

export type { AdminBadgeCounts };

interface AdminShellProps {
  children?: ReactNode;
  displayName: string;
  email: string;
  role: UserRole;
  badgeCounts?: AdminBadgeCounts | null;
}

export default function AdminShell({
  children,
  displayName,
  email,
  role,
  badgeCounts = null,
}: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        role={role}
        badgeCounts={badgeCounts}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col">
        <AdminTopbar
          displayName={displayName}
          email={email}
          role={role}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
