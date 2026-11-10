"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { findUserByEmail, grantRole } from "@/lib/admin/actions/staff-roles";
import { t } from "@/messages/en";
import type { StaffRole } from "@/types/role";

interface AddStaffDialogProps {
  onSuccess: () => void;
  onClose?: () => void;
}

type ErrorKey =
  | "admin.staff.error.not_found"
  | "admin.staff.error.validation_failed"
  | "admin.staff.error.code_invalid"
  | "admin.staff.error.unknown";

export function AddStaffDialog({ onSuccess, onClose }: AddStaffDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("admin");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setEmail("");
    setRole("admin");
    setTotpCode("");
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        // Step 1: resolve email → userId
        const lookupResult = await findUserByEmail({ email });
        if (!lookupResult.ok) {
          setError("admin.staff.error.not_found");
          return;
        }

        // Step 2: grant role with resolved userId + TOTP
        const result = await grantRole({
          userId: lookupResult.userId,
          role,
          totpCode,
        });

        if (result.ok) {
          handleClose();
          onSuccess();
        } else {
          const codeMap: Record<string, ErrorKey> = {
            not_found: "admin.staff.error.not_found",
            validation_failed: "admin.staff.error.validation_failed",
            unknown: "admin.staff.error.unknown",
          };
          setError(codeMap[result.code ?? "unknown"] ?? "admin.staff.error.unknown");
        }
      } catch {
        setError("admin.staff.error.code_invalid");
      }
    });
  }

  return (
    <>
      <button onClick={handleOpen} className="btn btn-primary">
        {t("admin.staff.add_button")}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label={t("admin.staff.add_dialog.title")}>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={handleClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4"
            >
              <h2 className="text-lg font-semibold">{t("admin.staff.add_dialog.title")}</h2>

              <div className="space-y-1">
                <label htmlFor="add-email" className="block text-sm font-medium">
                  {t("admin.staff.add_dialog.email_label")}
                </label>
                <input
                  id="add-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="add-role" className="block text-sm font-medium">
                  {t("admin.staff.add_dialog.role_label")}
                </label>
                <select
                  id="add-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full border rounded px-3 py-1.5 text-sm"
                >
                  <option value="admin">{t("admin.staff.add_dialog.role_admin")}</option>
                  <option value="editor">{t("admin.staff.add_dialog.role_editor")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="add-totp" className="block text-sm font-medium">
                  {t("admin.staff.add_dialog.totp_label")}
                </label>
                <input
                  id="add-totp"
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
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-ghost"
                >
                  {t("admin.staff.add_dialog.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn btn-primary"
                >
                  {t("admin.staff.add_dialog.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
