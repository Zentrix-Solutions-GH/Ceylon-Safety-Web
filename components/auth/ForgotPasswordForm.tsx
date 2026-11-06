"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/actions/request-password-reset";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { FormField } from "@/components/shared/FormField";
import { t } from "@/messages/en";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const resetTurnstileRef = useRef<(() => void) | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) return;
    setPending(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    // Always show neutral message regardless of ok/error (AC6, EC2 — never leak rate-limit or existence)
    try {
      await requestPasswordReset({
        email: data.get("email") as string,
        captchaToken,
      });
    } catch {
      // network/server error — treat the same as success (never expose internals)
    } finally {
      setPending(false);
      resetTurnstileRef.current?.();
      setCaptchaToken(null);
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t("auth.forgot_password.heading")}</h1>
        <p className="text-sm">{t("auth.forgot_password.sent")}</p>
        <Link href="/sign-in" className="text-sm text-primary underline">
          {t("auth.forgot_password.sign_in_link")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t("auth.forgot_password.heading")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="email" label={t("auth.forgot_password.email")} required>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </FormField>

        <TurnstileWidget
          onToken={setCaptchaToken}
          onRef={(fn) => { resetTurnstileRef.current = fn; }}
        />

        <button
          type="submit"
          disabled={pending || !captchaToken}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? t("auth.forgot_password.submitting") : t("auth.forgot_password.submit")}
        </button>
      </form>

      <p className="text-center text-sm">
        <Link href="/sign-in" className="text-primary underline">
          {t("auth.forgot_password.sign_in_link")}
        </Link>
      </p>
    </div>
  );
}
