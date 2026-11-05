"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth/actions/sign-in";
import { startGoogleSignIn } from "@/lib/auth/actions/start-google-sign-in";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { FormField } from "@/components/shared/FormField";
import { t, errorMessage } from "@/messages/en";

function isSocialAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|LinkedInApp|MicroMessenger|BytedanceWebview|Musical_ly/i.test(
    ua
  );
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const resetTurnstileRef = useRef<(() => void) | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socialApp = isSocialAppBrowser();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) return;
    setPending(true);
    setTopError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const result = await signIn({
      email: data.get("email") as string,
      password: data.get("password") as string,
      captchaToken,
      next,
    });

    if (result.ok) {
      router.replace(result.redirectTo);
      return;
    }

    if (result.code === "email_not_verified") {
      router.replace("/verify-email");
      setPending(false);
      return;
    }

    setTopError(errorMessage(result.code));
    resetTurnstileRef.current?.();
    setCaptchaToken(null);
    setPending(false);
  }

  async function handleGoogleSignIn() {
    setTopError(null);
    const result = await startGoogleSignIn({ next });
    if (!result.ok) {
      setTopError(errorMessage(result.code));
      return;
    }
    router.replace(result.url);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t("auth.sign_in.heading")}</h1>

      {topError && (
        <p role="alert" className="text-sm text-destructive">
          {topError}
        </p>
      )}

      {socialApp && (
        <div className="rounded-md border border-muted-foreground/30 bg-muted p-3 text-sm space-y-2">
          <p>{t("auth.sign_in.social_app_hint")}</p>
          <button
            type="button"
            onClick={handleCopyLink}
            className="underline text-primary"
          >
            {linkCopied ? t("auth.sign_in.link_copied") : t("auth.sign_in.copy_link")}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="email" label={t("auth.sign_in.email")} required>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </FormField>

        <FormField id="password" label={t("auth.sign_in.password")} required>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </FormField>

        <div className="text-right text-sm">
          <Link href="/forgot-password" className="text-primary underline">
            {t("auth.sign_in.forgot_password")}
          </Link>
        </div>

        <TurnstileWidget
          onToken={setCaptchaToken}
          onRef={(fn) => { resetTurnstileRef.current = fn; }}
        />

        <button
          type="submit"
          disabled={pending || !captchaToken}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? t("auth.sign_in.submitting") : t("auth.sign_in.submit")}
        </button>
      </form>

      <div className="relative text-center text-sm">
        <span className="relative z-10 bg-card px-2 text-muted-foreground">
          {t("auth.sign_in.or")}
        </span>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        {t("auth.sign_in.google_button")}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.sign_in.no_account")}{" "}
        <Link href="/sign-up" className="text-primary underline">
          {t("auth.sign_in.sign_up_link")}
        </Link>
      </p>
    </div>
  );
}
