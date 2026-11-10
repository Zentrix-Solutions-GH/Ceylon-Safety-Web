import { listStaff } from "@/lib/admin/actions/staff-roles";
import { requireSuperAdmin } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { StaffPageClient } from "./StaffPageClient";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) {
    redirect("/admin/dashboard");
  }

  const result = await listStaff();
  if (!result.ok) {
    return <StaffPageClient initialStaff={[]} currentUserId={auth.user.id} />;
  }

  return (
    <StaffPageClient
      initialStaff={result.staff}
      currentUserId={auth.user.id}
    />
  );
}
