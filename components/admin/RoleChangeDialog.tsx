"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { grantRole } from "@/lib/admin/actions/staff-roles";
import { t } from "@/messages/en";
import type { StaffRole } from "@/types/role";

interface RoleChangeDialogProps {
  userId: string;
  email: string;
  newRole: StaffRole;
  onSuccess: () => void;
  onClose: () => void;
}

type ErrorKey =
  | "admin.staff.error.validation_failed"
  | "admin.staff.error.not_allowed_super_admin"
  | "admin.staff.error.code_invalid"
  | "admin.staff.error.unknown";

export function RoleChangeDialog({
  userId,
  email,
  newRole,
  onSuccess,
  onClose,
}: RoleChangeDialogProps) {
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await grantRole({ userId, role: newRole, totpCode });
        if (result.ok) {
          onSuccess();
        } else {
          const codeMap: Record<string, ErrorKey> = {
            validation_failed: "admin.staff.error.validation_failed",
            not_allowed: "admin.staff.error.not_allowed_super_admin",
            unknown: "admin.staff.error.unknown",
          };
          setError(codeMap[result.code ?? "unknown"] ?? "admin.staff.error.unknown");
        }
      } catch {
        setError("admin.staff.error.code_invalid");
      }
    });
  }

  const roleLabel = newRole === "admin"
    ? t("admin.staff.add_dialog.role_admin")
    : t("admin.staff.add_dialog.role_editor");

  return (
    <div role="dialog" aria-modal="true" aria-label={t("admin.staff.role_change_dialog.title")}>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleConfirm}
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4"
        >
          <h2 className="text-lg font-semibold">{t("admin.staff.role_change_dialog.title")}</h2>

          <p className="text-sm text-gray-600">
            {t("admin.staff.role_change_dialog.body", { email, role: roleLabel })}
          </p>

          <div className="space-y-1">
            <label htmlFor="role-change-totp" className="block text-sm font-medium">
              {t("admin.staff.role_change_dialog.totp_label")}
            </label>
            <input
              id="role-change-totp"
              type="text"
              inputMode="numeric"
              required
              minLength={6}
              maxLength={8}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {t(error)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              {t("admin.staff.role_change_dialog.cancel")}
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {t("admin.staff.role_change_dialog.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
