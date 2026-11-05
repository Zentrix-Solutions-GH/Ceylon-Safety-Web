"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { signUp } from "@/lib/auth/actions/sign-up";
import { errorMessage, t } from "@/messages/en";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  terms?: string;
}

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const resetTurnstileRef = useRef<(() => void) | null>(null);

  const handleToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setCaptchaToken(null);
    setTopError(errorMessage("captcha_failed"));
  }, []);

  const handleTurnstileRef = useCallback((reset: () => void) => {
    resetTurnstileRef.current = reset;
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) {
      setTopError(errorMessage("captcha_failed"));
      return;
    }

    const form = e.currentTarget;
    const data = new FormData(form);

    setFieldErrors({});
    setTopError(null);
    setPending(true);

    try {
      const result = await signUp({
        firstName: (data.get("firstName") as string) ?? "",
        lastName: (data.get("lastName") as string) ?? "",
        email: (data.get("email") as string) ?? "",
        password: (data.get("password") as string) ?? "",
        termsAccepted: data.get("terms") === "on",
        captchaToken,
        next,
      });

      // Always reset the widget after a submission (tokens are single-use)
      resetTurnstileRef.current?.();
      setCaptchaToken(null);

      if (!result.ok) {
        const msg = errorMessage(result.code);
        if (result.field) {
          setFieldErrors({ [result.field]: msg });
        } else {
          setTopError(msg);
        }
        return;
      }

      router.replace(result.redirect);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-xl font-semibold mb-6">{t("auth.sign_up.heading")}</h1>

      {topError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {topError}
        </p>
      )}

      <div className="space-y-4">
        <FormField id="firstName" label={t("auth.sign_up.first_name")} required error={fieldErrors.firstName}>
          <Input name="firstName" autoComplete="given-name" />
        </FormField>

        <FormField id="lastName" label={t("auth.sign_up.last_name")} required error={fieldErrors.lastName}>
          <Input name="lastName" autoComplete="family-name" />
        </FormField>

        <FormField id="email" label={t("auth.sign_up.email")} required error={fieldErrors.email}>
          <Input name="email" type="email" autoComplete="email" />
        </FormField>

        <FormField id="password" label={t("auth.sign_up.password")} required error={fieldErrors.password}>
          <Input name="password" type="password" autoComplete="new-password" />
        </FormField>

        <div className="flex items-start gap-2">
          <Checkbox id="terms" name="terms" className="mt-0.5" />
          <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
            {t("auth.sign_up.terms")}{" "}
            <Link href="/terms" className="underline hover:no-underline">
              {t("auth.sign_up.terms_link")}
            </Link>{" "}
            {t("auth.sign_up.and")}{" "}
            <Link href="/privacy" className="underline hover:no-underline">
              {t("auth.sign_up.privacy_link")}
            </Link>
          </Label>
        </div>
        {fieldErrors.terms && (
          <p className="text-sm text-destructive" role="alert">{fieldErrors.terms}</p>
        )}

        <TurnstileWidget
          onToken={handleToken}
          onError={handleTurnstileError}
          onRef={handleTurnstileRef}
        />

        <button
          type="submit"
          disabled={pending || !captchaToken}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? t("auth.sign_up.submitting") : t("auth.sign_up.submit")}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          {t("auth.sign_up.have_account")}{" "}
          <Link href="/sign-in" className="underline hover:no-underline">
            {t("auth.sign_up.sign_in_link")}
          </Link>
        </p>
      </div>
    </form>
  );
}
