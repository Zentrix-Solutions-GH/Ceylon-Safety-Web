"use client";

import * as React from "react";
import { useState } from "react";
import type { StaffListItem, StaffRole } from "@/types/role";
import { t } from "@/messages/en";
import { RemoveStaffDialog } from "./RemoveStaffDialog";
import { RoleChangeDialog } from "./RoleChangeDialog";

interface StaffTableProps {
  staff: StaffListItem[];
  currentUserId: string;
  onRefresh: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return t("admin.staff.table.never");
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function StaffTable({ staff, currentUserId, onRefresh }: StaffTableProps) {
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    email: string;
    newRole: StaffRole;
  } | null>(null);

  const [pendingRemove, setPendingRemove] = useState<{
    userId: string;
    email: string;
  } | null>(null);

  function handleRoleChange(item: StaffListItem, newRole: StaffRole) {
    if (newRole === item.role) return;
    setPendingRoleChange({ userId: item.userId, email: item.email, newRole });
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">{t("admin.staff.table.email")}</th>
            <th className="py-2 pr-4">{t("admin.staff.table.role")}</th>
            <th className="py-2 pr-4">{t("admin.staff.table.last_sign_in")}</th>
            <th className="py-2 pr-4">{t("admin.staff.table.totp")}</th>
            <th className="py-2">{t("admin.staff.table.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((item) => (
            <tr key={item.userId} className="border-b">
              <td className="py-2 pr-4">{item.email}</td>
              <td className="py-2 pr-4">
                <select
                  aria-label={t("admin.staff.table.role")}
                  value={item.role}
                  onChange={(e) =>
                    handleRoleChange(item, e.target.value as StaffRole)
                  }
                  className="border rounded px-1 py-0.5"
                >
                  <option value="admin">{t("admin.staff.add_dialog.role_admin")}</option>
                  <option value="editor">{t("admin.staff.add_dialog.role_editor")}</option>
                </select>
              </td>
              <td className="py-2 pr-4">{formatDate(item.lastSignInAt)}</td>
              <td className="py-2 pr-4">
                {item.hasTotpEnrolled ? (
                  <span className="text-green-700 text-xs">
                    {t("admin.staff.table.totp_enrolled")}
                  </span>
                ) : (
                  <span
                    data-testid={`totp-warning-${item.userId}`}
                    className="text-amber-600 text-xs font-medium"
                  >
                    {t("admin.staff.table.totp_missing")}
                  </span>
                )}
              </td>
              <td className="py-2">
                <button
                  onClick={() =>
                    setPendingRemove({ userId: item.userId, email: item.email })
                  }
                  className="text-red-600 hover:underline text-xs"
                >
                  {t("admin.staff.table.remove")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pendingRoleChange && (
        <RoleChangeDialog
          userId={pendingRoleChange.userId}
          email={pendingRoleChange.email}
          newRole={pendingRoleChange.newRole}
          onSuccess={() => {
            setPendingRoleChange(null);
            onRefresh();
          }}
          onClose={() => setPendingRoleChange(null)}
        />
      )}

      <RemoveStaffDialog
        open={pendingRemove !== null}
        userId={pendingRemove?.userId ?? ""}
        email={pendingRemove?.email ?? ""}
        isSelf={pendingRemove?.userId === currentUserId}
        onSuccess={() => {
          setPendingRemove(null);
          onRefresh();
        }}
        onClose={() => setPendingRemove(null)}
      />
    </>
  );
}
