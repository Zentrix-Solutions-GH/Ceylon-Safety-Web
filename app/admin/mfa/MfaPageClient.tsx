"use client";

import { useState, useTransition } from "react";
import { submitMFAChallenge } from "@/lib/admin/actions/mfa-challenge";
import { t, errorMessage } from "@/messages/en";

interface Props {
  /** Validated redirect target from the pending-redirect cookie (AC3). Falls back to /admin/dashboard. */
  next: string;
}

export default function MfaPageClient({ next }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitMFAChallenge({ code });
      if (result.ok) {
        // AC3: session now aal2 — navigate to intended page from cookie
        window.location.href =
          next && next.startsWith("/admin") ? next : "/admin/dashboard";
      } else {
        setError(errorMessage(result.code));
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-semibold">{t("admin.mfa.heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.mfa.instructions")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="mfa-code" className="sr-only">
              {t("admin.mfa.code_label")}
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("admin.mfa.code_placeholder")}
              className="w-full rounded border px-3 py-2 text-center text-lg tracking-widest"
              autoComplete="one-time-code"
              disabled={isPending}
              aria-label={t("admin.mfa.code_label")}
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || code.length !== 6}
            className="w-full rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {isPending ? t("admin.mfa.submitting") : t("admin.mfa.submit_button")}
          </button>
        </form>
      </div>
    </div>
  );
}
