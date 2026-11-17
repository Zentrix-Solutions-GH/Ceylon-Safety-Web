"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, Shield, ArrowLeft } from "lucide-react";
import { signIn } from "@/lib/auth/actions/sign-in";
import { startGoogleSignIn } from "@/lib/auth/actions/start-google-sign-in";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { t, errorMessage } from "@/messages/en";
import { GoogleLogo } from "@/components/icons/GoogleLogo";
import { publicConfig } from "@/lib/config.public";

function isSocialAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|LinkedInApp|MicroMessenger|BytedanceWebview|Musical_ly/i.test(ua);
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const resetTurnstileRef = useRef<(() => void) | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [socialApp, setSocialApp] = useState(false);

  useEffect(() => { setSocialApp(isSocialAppBrowser()); }, []);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) return;
    setPending(true);
    setTopError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    try {
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
        return;
      }

      setTopError(errorMessage(result.code));
    } catch {
      setTopError(errorMessage("unknown"));
    } finally {
      resetTurnstileRef.current?.();
      setCaptchaToken(null);
      setPending(false);
    }
  }

  async function handleGoogleSignIn() {
    if (pending) return;
    setPending(true);
    setTopError(null);
    try {
      const result = await startGoogleSignIn({ next });
      if (!result.ok) {
        setTopError(errorMessage(result.code));
        return;
      }
      router.replace(result.url);
    } catch {
      setTopError(errorMessage("unknown"));
    } finally {
      setPending(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard unavailable - silent fail
    }
  }

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
          {/* Left panel - branding */}
          <div className="relative m-3 hidden flex-col justify-between overflow-hidden rounded-2xl bg-primary-darker lg:flex lg:w-[45%]">
            {/* Background construction image */}
            <div className="absolute inset-0">
              <Image
                src={`${publicConfig.mediaCdnUrl}/auth/sign-in-bg.jpg`}
                alt=""
                fill
                sizes="(min-width: 1024px) 45vw, 0px"
                className="object-cover object-center opacity-50"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary-darker/75 via-primary-darker/65 to-primary-deepest/95" />
            </div>

            <div className="relative z-10 p-7">
              <div className="mb-8 flex items-center justify-between">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("auth.sign_in.panel.return_link")}
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Secure connection
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

            <div className="relative z-10 px-7 pb-3">
              <h2 className="mb-3 text-3xl font-bold leading-tight text-white">
                {t("auth.sign_in.panel.tagline")}
              </h2>
              <p className="mb-7 text-sm leading-relaxed text-white/80">
                {t("auth.sign_in.panel.description")}
              </p>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-white">1,240+</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                    {t("auth.sign_in.panel.badge_trainers")}
                  </div>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-white">100%</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                    {t("auth.sign_in.panel.badge_audit")}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-2 px-7 pb-6 text-xs text-white/60">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>Sri Lanka National Safety Grid &bull; Accredited Training &amp; Statutory Documentation Authority</span>
            </div>
          </div>

          {/* Right panel - form */}
          <div className="flex flex-1 flex-col justify-between bg-white px-6 py-8 sm:px-10 lg:px-14">
            <div className="mx-auto my-auto w-full max-w-md">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  {t("auth.sign_in.panel.portal_label")}
                </span>
              </div>

              <h1 className="mb-1 text-3xl font-bold text-gray-900">{t("auth.sign_in.heading")}</h1>
              <p className="mb-7 text-sm text-gray-500">
                {t("auth.sign_in.subtitle")}
              </p>

              {topError && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {topError}
                </p>
              )}

              {socialApp && (
                <div className="mb-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p>{t("auth.sign_in.social_app_hint")}</p>
                  <button type="button" onClick={handleCopyLink} className="text-primary underline">
                    {linkCopied ? t("auth.sign_in.link_copied") : t("auth.sign_in.copy_link")}
                  </button>
                </div>
              )}

              {/* Google sign-in */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={pending}
                className="mb-5 flex w-full items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <GoogleLogo className="h-5 w-5" />
                {t("auth.sign_in.google_button")}
              </button>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-medium uppercase tracking-widest text-gray-400">
                    {t("auth.sign_in.or_email")}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      {t("auth.sign_in.email")}
                    </label>
                    <span className="text-xs text-gray-400">{t("auth.sign_in.email_hint")}</span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="name@workplace.lk"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      {t("auth.sign_in.password")}
                    </label>
                    <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                      {t("auth.sign_in.forgot_password")}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm placeholder-gray-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? t("auth.sign_in.hide_password") : t("auth.sign_in.show_password")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" name="remember" className="h-4 w-4 rounded border-gray-300 accent-primary" />
                    <span className="text-sm text-gray-600">{t("auth.sign_in.panel.remember_device")}</span>
                  </label>
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <Shield className="h-3.5 w-3.5" />
                    {t("auth.sign_in.panel.ssl")}
                  </span>
                </div>

                <TurnstileWidget
                  onToken={setCaptchaToken}
                  onRef={(fn) => { resetTurnstileRef.current = fn; }}
                />

                <button
                  type="submit"
                  disabled={pending || !captchaToken}
                  className="w-full rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {pending ? t("auth.sign_in.submitting") : `${t("auth.sign_in.submit")} →`}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                {t("auth.sign_in.no_account")}{" "}
                <Link href="/sign-up" className="font-semibold text-primary hover:underline">
                  {t("auth.sign_in.sign_up_link")}
                </Link>
              </p>
            </div>

            {/* Bottom links */}
            <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-green-500" /> {t("auth.sign_in.enterprise_tag")}
              </span>
              <span>&bull;</span>
              <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
              <span>&bull;</span>
              <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
              <span>&bull;</span>
              <Link href="/disclaimer" className="hover:text-gray-600">Statutory Disclaimer</Link>
            </div>
          </div>
        </div>

        {/* Page footer */}
        <footer className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} Ceylon Safety Council. The Most Official Registry.</span>
          <span>&bull;</span>
          <span>Designed &amp; Developed by <span className="font-semibold text-white/60">Zentrix Solutions</span></span>
        </footer>
      </div>
    </div>
  );
}
