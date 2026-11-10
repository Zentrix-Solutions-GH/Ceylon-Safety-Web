// S-045: Admin shell — sidebar + topbar wrapping all admin pages.
// AC6: no ad/analytics scripts — this layout has no ScriptGate.
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Explicit allowlist — guards against future UserRole values (e.g. "customer")
// accidentally passing through the admin shell.
const STAFF_ROLES = ["super_admin", "admin", "editor"] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Defense in depth — middleware already redirects unauthenticated users.
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.includes(user.claimedRole as (typeof STAFF_ROLES)[number])) {
    redirect("/sign-in");
  }

  // Fetch display_name from profiles; fall back to email if missing.
  let displayName = user.email;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    if (data?.display_name) displayName = data.display_name;
  } catch {
    // Non-fatal — email fallback is fine
  }

  return (
    <AdminShell
      displayName={displayName}
      email={user.email}
      role={user.claimedRole!}
    >
      {children}
    </AdminShell>
  );
}
