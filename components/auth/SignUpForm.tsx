"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, User, Shield, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { signUp } from "@/lib/auth/actions/sign-up";
import { errorMessage, t } from "@/messages/en";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { publicConfig } from "@/lib/config.public";

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Fair", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-green-500" };
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
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

    if (passwordValue !== confirmValue) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match" }));
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

  const strength = getPasswordStrength(passwordValue);

  return (
    <div className="relative min-h-screen bg-surface-dark px-4 py-5 sm:px-8 lg:px-12">
      {/* Full-page background image with dark overlay */}
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/auth/auth-outer-bg.jpg" alt="" className="h-full w-full object-cover object-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-deepest/60 via-surface-dark/80 to-surface-dark" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">
        {/* Top bar */}
        <header className="mb-4 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
              <Image src="/logo.jpg" alt="Ceylon Safety" width={36} height={36} className="object-contain" />
            </div>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-white">Ceylon Safety</span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/50">
                National Compliance Portal
              </span>
            </span>
          </Link>
        </header>

        {/* Card */}
        <div className="flex flex-1 overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
          {/* Left panel — branding */}
          <div className="relative m-3 hidden flex-col justify-between overflow-hidden rounded-2xl bg-primary-darker lg:flex lg:w-[45%]">
            <div className="absolute inset-0">
              <Image
                src={`${publicConfig.mediaCdnUrl}/auth/sign-up-bg.jpg`}
                alt=""
                fill
                sizes="(min-width: 1024px) 45vw, 0px"
                className="object-cover object-center opacity-30"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary-darker/80 via-primary-darker/70 to-primary-deepest/90" />
            </div>

            {/* Top section */}
            <div className="relative z-10 p-7">
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Official Sri Lanka Safety Registry
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
                  <Image src="/logo.jpg" alt="Ceylon Safety" width={48} height={48} className="object-contain" />
                </div>
                <div className="text-white">
                  <div className="text-xl font-black leading-tight tracking-wide">CEYLON</div>
                  <div className="text-xl font-black leading-tight tracking-wide">SAFETY</div>
                </div>
              </div>
            </div>

            {/* Middle section */}
            <div className="relative z-10 px-7 pb-3">
              <h2 className="mb-3 text-3xl font-bold leading-tight text-white">
                {t("auth.sign_up.panel.tagline")}
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-white/80">
                {t("auth.sign_up.panel.description")}
              </p>

              {/* Feature list */}
              <div className="mb-6 space-y-3">
                {[
                  "Standard Compliance Guarantee & Certification",
                  "Direct Access to Island-wide Certified Training Centres",
                  "Standardised Site Inspection Reports & Checklists",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <span className="text-xs leading-relaxed text-white/80">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-white">1,240+</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                    Co-Trainers
                  </div>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-white">10,000+</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                    Safety Specialists
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-2 px-7 pb-6 text-xs text-white/60">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>Accredited under National Safety Standards Framework</span>
            </div>
          </div>

          {/* Right panel — form */}
          <div className="flex flex-1 flex-col justify-between bg-white px-6 py-8 sm:px-10 lg:px-16">
            <div className="my-auto w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Secure Portal Registration
                </span>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-1">{t("auth.sign_up.heading")}</h1>
              <p className="text-sm text-gray-500 mb-7">
                Start your journey to safety officers, compliance managers, and certifications.
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
                      {t("auth.sign_up.first_name")}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        autoComplete="given-name"
                        required
                        placeholder="e.g. Kasun"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      />
                    </div>
                    {fieldErrors.firstName && <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>}
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t("auth.sign_up.last_name")}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        autoComplete="family-name"
                        required
                        placeholder="e.g. Perera"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      />
                    </div>
                    {fieldErrors.lastName && <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t("auth.sign_up.email")}
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
                    {t("auth.sign_up.password")}
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
                      value={passwordValue}
                      onChange={(e) => setPasswordValue(e.target.value)}
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
                  {/* Password strength indicator */}
                  {passwordValue && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-gray-200"}`}
                          />
                        ))}
                      </div>
                      <p className={`mt-1 text-xs font-medium ${strength.score <= 1 ? "text-red-500" : strength.score <= 3 ? "text-yellow-600" : "text-green-600"}`}>
                        {strength.label} password
                      </p>
                    </div>
                  )}
                  {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t("auth.sign_up.confirm_password")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="••••••••••"
                      value={confirmValue}
                      onChange={(e) => {
                        setConfirmValue(e.target.value);
                        if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.confirmPassword}</p>
                  )}
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
                      {" "}and Ceylon Safety compliance guidelines.
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
              <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
              <span>•</span>
              <Link href="/disclaimer" className="hover:text-gray-600">Compliance Notice</Link>
            </div>
          </div>
        </div>

        {/* Page footer */}
        <footer className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} Ceylon Safety Council. Verified Enterprise Security.</span>
          <span>&bull;</span>
          <span>Designed &amp; Developed by <span className="font-semibold text-white/60">Zentrix Solutions</span></span>
        </footer>
      </div>
    </div>
  );
}
