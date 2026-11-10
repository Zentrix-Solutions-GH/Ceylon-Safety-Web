"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import type { StaffListItem } from "@/types/role";
import { listStaff } from "@/lib/admin/actions/staff-roles";
import { t } from "@/messages/en";
import { StaffTable } from "@/components/admin/StaffTable";
import { AddStaffDialog } from "@/components/admin/AddStaffDialog";

interface StaffPageClientProps {
  initialStaff: StaffListItem[];
  currentUserId: string;
}

export function StaffPageClient({ initialStaff, currentUserId }: StaffPageClientProps) {
  const [staff, setStaff] = useState<StaffListItem[]>(initialStaff);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await listStaff();
      if (result.ok) {
        setStaff(result.staff);
      }
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("admin.staff.page_title")}</h1>
        <AddStaffDialog onSuccess={refresh} />
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-gray-500">{t("admin.staff.empty")}</p>
      ) : (
        <StaffTable staff={staff} currentUserId={currentUserId} onRefresh={refresh} />
      )}
    </div>
  );
}
