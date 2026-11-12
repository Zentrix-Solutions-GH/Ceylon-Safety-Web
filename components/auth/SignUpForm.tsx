"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, User, Shield, Eye, EyeOff } from "lucide-react";
import { signUp } from "@/lib/auth/actions/sign-up";
import { errorMessage, t } from "@/messages/en";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { publicConfig } from "@/lib/config.public";

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const resetTurnstileRef = useRef<(() => void) | null>(null);

  const handleToken = useCallback((token: string) => { setCaptchaToken(token); }, []);
  const handleTurnstileError = useCallback(() => {
    setCaptchaToken(null);
    setTopError(errorMessage("captcha_failed"));
  }, []);
  const handleTurnstileRef = useCallback((reset: () => void) => {
    resetTurnstileRef.current = reset;
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) { setTopError(errorMessage("captcha_failed")); return; }

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

      resetTurnstileRef.current?.();
      setCaptchaToken(null);

      if (!result.ok) {
        const msg = errorMessage(result.code);
        if (result.field) { setFieldErrors({ [result.field]: msg }); }
        else { setTopError(msg); }
        return;
      }

      router.replace(result.redirect);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden bg-primary-darker">
        <div className="absolute inset-0">
          <Image
            src={`${publicConfig.mediaCdnUrl}/auth/sign-up-bg.jpg`}
            alt=""
            fill
            className="object-cover object-center opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-darker/80 via-primary-darker/70 to-primary-deepest/90" />
        </div>

        <div className="relative z-10 p-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg">
              <span className="text-lg font-black text-primary">CS</span>
            </div>
            <div className="text-white">
              <div className="text-xl font-black tracking-wide leading-tight">CEYLON</div>
              <div className="text-xl font-black tracking-wide leading-tight">SAFETY</div>
            </div>
          </Link>
        </div>

        <div className="relative z-10 px-8 pb-4">
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            {t("auth.sign_up.panel.tagline")}
          </h2>
          <p className="text-white/80 text-sm leading-relaxed mb-8">
            {t("auth.sign_up.panel.description")}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4 border border-white/20">
              <div className="text-2xl font-black text-white">5,000+</div>
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mt-1">{t("auth.sign_up.panel.badge_docs")}</div>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4 border border-white/20">
              <div className="text-2xl font-black text-white">Free</div>
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mt-1">{t("auth.sign_up.panel.badge_free")}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-8 pb-8 flex items-center gap-2 text-white/60 text-xs">
          <Shield className="h-3.5 w-3.5" />
          <span>Sri Lanka National Safety Grid • Accredited Training &amp; Statutory Documentation Authority</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col justify-between bg-white px-6 py-8 sm:px-10 lg:px-16">
        <div className="flex justify-end text-sm text-gray-500 lg:hidden">
          <Link href="/" className="text-primary font-semibold">{t("auth.sign_up.panel.return_link")}</Link>
        </div>

        <div className="my-auto w-full max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("auth.sign_up.panel.portal_label")}</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-1">{t("auth.sign_up.heading")}</h1>
          <p className="text-sm text-gray-500 mb-7">
            Start accessing Sri Lanka&apos;s largest occupational safety resource library.
          </p>

          {topError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {topError}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("auth.sign_up.first_name")} <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
                {fieldErrors.firstName && <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("auth.sign_up.last_name")} <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
                {fieldErrors.lastName && <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("auth.sign_up.email")} <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-invalid={fieldErrors.email ? "true" : undefined}
                  placeholder="name@workplace.lk"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("auth.sign_up.password")} <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t("auth.sign_up.hide_password") : t("auth.sign_up.show_password")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="terms"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span className="text-sm text-gray-600 leading-snug">
                  {t("auth.sign_up.terms")}{" "}
                  <Link href="/terms" className="font-medium text-primary hover:underline">{t("auth.sign_up.terms_link")}</Link>
                  {" "}{t("auth.sign_up.and")}{" "}
                  <Link href="/privacy" className="font-medium text-primary hover:underline">{t("auth.sign_up.privacy_link")}</Link>
                </span>
              </label>
              {fieldErrors.terms && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.terms}</p>}
            </div>

            <TurnstileWidget
              onToken={handleToken}
              onError={handleTurnstileError}
              onRef={handleTurnstileRef}
            />

            <button
              type="submit"
              disabled={pending || !captchaToken || !termsAccepted}
              className="w-full rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-lg shadow-red-900/20"
            >
              {pending ? t("auth.sign_up.submitting") : `${t("auth.sign_up.submit")} →`}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            {t("auth.sign_up.have_account")}{" "}
            <Link href="/sign-in" className="font-semibold text-primary hover:underline">
              {t("auth.sign_up.sign_in_link")}
            </Link>
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-green-500" /> Enterprise Security Enforced</span>
          <span>•</span>
          <Link href="/disclaimer" className="hover:text-gray-600">Statutory Disclaimer</Link>
        </div>
      </div>
    </div>
  );
}
