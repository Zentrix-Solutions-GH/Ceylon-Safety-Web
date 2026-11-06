"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth/actions/reset-password";
import { FormField } from "@/components/shared/FormField";
import { t, errorMessage } from "@/messages/en";

interface Props {
  /** Email pre-filled from pending-reset cookie. If absent, user must type their email (EC1). */
  email?: string;
}

export function ResetPasswordForm({ email: initialEmail }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [showTotp, setShowTotp] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setTopError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const email = (data.get("email") as string) || initialEmail || "";
    const code = data.get("code") as string;
    const newPassword = data.get("newPassword") as string;
    const authenticatorCode = (data.get("authenticatorCode") as string) || undefined;

    try {
      const result = await resetPassword({ email, code, newPassword, authenticatorCode });

      if (result.ok) {
        router.replace(result.redirectTo);
        return;
      }

      if (result.code === "mfa_required") {
        setShowTotp(true);
        return;
      }

      setTopError(errorMessage(result.code));
    } catch {
      setTopError(errorMessage("unknown"));
    } finally {
      setPending(false);
    }
  }

  const emailPrefilled = !!initialEmail;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t("auth.reset_password.heading")}</h1>

      {!emailPrefilled && (
        <p className="text-sm text-muted-foreground">{t("auth.reset_password.no_pending")}</p>
      )}

      {topError && (
        <p role="alert" className="text-sm text-destructive">
          {topError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="email" label={t("auth.reset_password.email")} required>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={initialEmail ?? ""}
            readOnly={!!initialEmail}
            className="w-full rounded-md border px-3 py-2 text-sm read-only:bg-muted"
          />
        </FormField>

        <FormField id="code" label={t("auth.reset_password.code")} required>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            defaultValue=""
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </FormField>

        <FormField id="newPassword" label={t("auth.reset_password.new_password")} required>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            defaultValue=""
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </FormField>

        {showTotp && (
          <FormField id="authenticatorCode" label={t("auth.reset_password.totp")} required>
            <input
              id="authenticatorCode"
              name="authenticatorCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </FormField>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? t("auth.reset_password.submitting") : t("auth.reset_password.submit")}
        </button>
      </form>
    </div>
  );
}
