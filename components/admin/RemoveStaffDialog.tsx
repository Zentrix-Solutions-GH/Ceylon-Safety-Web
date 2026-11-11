"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { removeRole } from "@/lib/admin/actions/staff-roles";
import { t } from "@/messages/en";

interface RemoveStaffDialogProps {
  open: boolean;
  userId: string;
  email: string;
  isSelf: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type ErrorKey =
  | "admin.staff.error.not_allowed_super_admin"
  | "admin.staff.error.not_allowed_self"
  | "admin.staff.error.code_invalid"
  | "admin.staff.error.not_found_remove"
  | "admin.staff.error.unknown";

export function RemoveStaffDialog({
  open,
  userId,
  email,
  isSelf,
  onSuccess,
  onClose,
}: RemoveStaffDialogProps) {
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setTotpCode("");
    setError(null);
    onClose();
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await removeRole({ userId, totpCode });
        if (result.ok) {
          handleClose();
          onSuccess();
        } else {
          if (result.code === "not_allowed") {
            setError(
              isSelf
                ? "admin.staff.error.not_allowed_self"
                : "admin.staff.error.not_allowed_super_admin"
            );
          } else if (result.code === "not_found") {
            setError("admin.staff.error.not_found_remove");
          } else {
            setError("admin.staff.error.unknown");
          }
        }
      } catch {
        setError("admin.staff.error.code_invalid");
      }
    });
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={t("admin.staff.remove_dialog.title")}>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleConfirm}
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4"
        >
          <h2 className="text-lg font-semibold">{t("admin.staff.remove_dialog.title")}</h2>

          <p className="text-sm text-gray-600">
            {t("admin.staff.remove_dialog.body", { email })}
          </p>

          <div className="space-y-1">
            <label htmlFor="remove-totp" className="block text-sm font-medium">
              {t("admin.staff.remove_dialog.totp_label")}
            </label>
            <input
              id="remove-totp"
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
            <button type="button" onClick={handleClose} className="btn btn-ghost">
              {t("admin.staff.remove_dialog.cancel")}
            </button>
            <button type="submit" disabled={isPending} className="btn btn-destructive">
              {t("admin.staff.remove_dialog.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
