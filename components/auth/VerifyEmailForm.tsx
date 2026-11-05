"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { verifyEmail } from "@/lib/auth/actions/verify-email";
import { resendCode } from "@/lib/auth/actions/resend-code";
import { errorMessage, t } from "@/messages/en";

const RESEND_COOLDOWN_SECONDS = 60;

interface VerifyEmailFormProps {
  pendingEmail: string | null;
}

export function VerifyEmailForm({ pendingEmail }: VerifyEmailFormProps) {
  const router = useRouter();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const resetTurnstileRef = useRef<(() => void) | null>(null);

  const handleToken = useCallback((token: string) => setCaptchaToken(token), []);
  const handleTurnstileRef = useCallback((reset: () => void) => {
    resetTurnstileRef.current = reset;
  }, []);

  // ── Pre-step: no pending cookie ───────────────────────────────────────────
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(pendingEmail);
  const [preStepError, setPreStepError] = useState<string | null>(null);
  const [preStepPending, setPreStepPending] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) {
      setPreStepError(errorMessage("captcha_failed"));
      return;
    }
    const data = new FormData(e.currentTarget);
    const email = (data.get("email") as string) ?? "";
    setPreStepPending(true);
    setPreStepError(null);
    try {
      const result = await resendCode({ email, captchaToken });
      resetTurnstileRef.current?.();
      setCaptchaToken(null);
      if (!result.ok) {
        setPreStepError(errorMessage(result.code, (result as { reason?: string }).reason));
        return;
      }
      setResolvedEmail(email);
      startCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setPreStepPending(false);
    }
  }

  // ── Resend cooldown ───────────────────────────────────────────────────────
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown(seconds: number) {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSeconds(seconds);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Verify code ──────────────────────────────────────────────────────────
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifyPending, setVerifyPending] = useState(false);

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const code = (data.get("code") as string) ?? "";
    setCodeError(null);
    setVerifyPending(true);
    try {
      const result = await verifyEmail({ email: resolvedEmail!, code });
      if (!result.ok) {
        setCodeError(errorMessage(result.code));
        return;
      }
      router.replace(result.redirect);
    } finally {
      setVerifyPending(false);
    }
  }

  // ── Resend ──────────────────────────────────────────────────────────────
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend() {
    if (!captchaToken || cooldownSeconds > 0) return;
    setResendError(null);
    const result = await resendCode({ email: resolvedEmail!, captchaToken });
    resetTurnstileRef.current?.();
    setCaptchaToken(null);
    if (!result.ok) {
      const retryAfter = (result as { retryAfterSeconds?: number }).retryAfterSeconds;
      if (retryAfter) {
        startCooldown(retryAfter);
      }
      setResendError(errorMessage(result.code, (result as { reason?: string }).reason));
      return;
    }
    startCooldown(RESEND_COOLDOWN_SECONDS);
  }

  // ── Pre-step render ───────────────────────────────────────────────────────
  if (!resolvedEmail) {
    return (
      <form onSubmit={handleEmailSubmit} noValidate>
        <h1 className="text-xl font-semibold mb-6">{t("auth.verify_email.enter_email_heading")}</h1>

        {preStepError && (
          <p role="alert" className="mb-4 text-sm text-destructive">{preStepError}</p>
        )}

        <div className="space-y-4">
          <FormField id="email" label={t("auth.verify_email.enter_email_label")} required hint={t("auth.verify_email.enter_email_hint")}>
            <Input name="email" type="email" autoComplete="email" />
          </FormField>

          <TurnstileWidget
            onToken={handleToken}
            onError={() => setPreStepError(errorMessage("captcha_failed"))}
            onRef={handleTurnstileRef}
          />

          <button
            type="submit"
            disabled={preStepPending || !captchaToken}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t("auth.verify_email.enter_email_submit")}
          </button>
        </div>
      </form>
    );
  }

  // ── Verify-code render ────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">{t("auth.verify_email.heading")}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {t("auth.verify_email.code_sent")} <strong>{resolvedEmail}</strong>
      </p>

      <form onSubmit={handleVerify} noValidate>
        <div className="space-y-4">
          {codeError && (
            <p role="alert" className="text-sm text-destructive">{codeError}</p>
          )}

          <FormField id="code" label={t("auth.verify_email.code_label")} required error={undefined}>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              maxLength={8}
            />
          </FormField>

          <button
            type="submit"
            disabled={verifyPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {verifyPending ? t("auth.verify_email.submitting") : t("auth.verify_email.submit")}
          </button>
        </div>
      </form>

      {/* Resend section — needs Turnstile for a fresh token */}
      <div className="mt-4 space-y-2">
        {resendError && (
          <p role="alert" className="text-sm text-destructive">{resendError}</p>
        )}

        <TurnstileWidget onToken={handleToken} onRef={handleTurnstileRef} />

        <button
          type="button"
          disabled={cooldownSeconds > 0 || !captchaToken}
          onClick={handleResend}
          className="text-sm underline hover:no-underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldownSeconds > 0
            ? t("auth.verify_email.resend_wait").replace("{seconds}", String(cooldownSeconds))
            : t("auth.verify_email.resend")}
        </button>

        <div>
          <Link href="/sign-up" className="text-sm underline hover:no-underline">
            {t("auth.verify_email.different_email")}
          </Link>
        </div>
      </div>
    </div>
  );
}
