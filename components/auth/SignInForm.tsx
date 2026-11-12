"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, Shield } from "lucide-react";
import { signIn } from "@/lib/auth/actions/sign-in";
import { startGoogleSignIn } from "@/lib/auth/actions/start-google-sign-in";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { t, errorMessage } from "@/messages/en";
import { GoogleLogo } from "@/components/icons/GoogleLogo";

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
      // clipboard unavailable — silent fail
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden bg-primary-darker">
        {/* Background construction image */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80"
            alt=""
            fill
            className="object-cover object-center opacity-30"
            unoptimized
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
            Welcome back.<br />Stay safe, keep learning.
          </h2>
          <p className="text-white/80 text-sm leading-relaxed mb-8">
            The national gateway for accredited occupational compliance, technical field certifications,
            and verified safety documentation across Sri Lanka.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4 border border-white/20">
              <div className="text-2xl font-black text-white">1,240+</div>
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mt-1">Certified Trainers</div>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4 border border-white/20">
              <div className="text-2xl font-black text-white">100%</div>
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mt-1">Statutory Audit Ready</div>
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
          <Link href="/" className="text-primary font-semibold">← Return to Portal</Link>
        </div>

        <div className="my-auto w-full max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Secure Portal Login</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-1">{t("auth.sign_in.heading")}</h1>
          <p className="text-sm text-gray-500 mb-7">
            Enter your credentials to access your courses, statutory documents, and trainer network.
          </p>

          {topError && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {topError}
            </p>
          )}

          {socialApp && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-2">
              <p>{t("auth.sign_in.social_app_hint")}</p>
              <button type="button" onClick={handleCopyLink} className="underline text-primary">
                {linkCopied ? t("auth.sign_in.link_copied") : t("auth.sign_in.copy_link")}
              </button>
            </div>
          )}

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={pending}
            className="w-full flex items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors mb-5"
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
                {t("auth.sign_in.or")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t("auth.sign_in.email")}
                </label>
                <span className="text-xs text-gray-400">Work or Corporate</span>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@workplace.lk"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t("auth.sign_in.password")}
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                  {t("auth.sign_in.forgot_password")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="remember" className="h-4 w-4 rounded border-gray-300 accent-primary" />
                <span className="text-sm text-gray-600">Remember this device</span>
              </label>
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <Shield className="h-3.5 w-3.5" />
                256-bit SSL
              </span>
            </div>

            <TurnstileWidget
              onToken={setCaptchaToken}
              onRef={(fn) => { resetTurnstileRef.current = fn; }}
            />

            <button
              type="submit"
              disabled={pending || !captchaToken}
              className="w-full rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-lg shadow-red-900/20"
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
          <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-green-500" /> Enterprise Security Enforced</span>
          <span>•</span>
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
          <span>•</span>
          <Link href="/disclaimer" className="hover:text-gray-600">Statutory Disclaimer</Link>
        </div>
      </div>
    </div>
  );
}
