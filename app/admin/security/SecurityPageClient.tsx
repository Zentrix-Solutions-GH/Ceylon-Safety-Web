"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import QRCode from "qrcode";
import { confirmMFAEnrolment } from "@/lib/admin/actions/mfa-enrolment";
import { t, errorMessage } from "@/messages/en";

interface Props {
  factorId: string;
  /** otpauth:// URI — rendered into QR code client-side (EC2: never sent to a third-party) */
  uri: string;
  secret: string;
  /** Validated redirect target from the pending-redirect cookie (AC1). Falls back to /admin/dashboard. */
  next: string;
}

export default function SecurityPageClient({ factorId, uri, secret, next }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // EC2: QR code rendered client-side from the URI
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, uri, { width: 200 });
    }
  }, [uri]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmMFAEnrolment({ factorId, code });
      if (result.ok) {
        setSuccess(true);
        // AC1: redirect to intended admin page from cookie, fall back to dashboard
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
        <h1 className="text-xl font-semibold">{t("admin.security.heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.security.instructions")}</p>

        {/* EC2: canvas rendered from URI, no third-party QR service */}
        <canvas ref={canvasRef} className="mx-auto rounded" />

        <div>
          <p className="text-xs text-muted-foreground mb-1">{t("admin.security.secret_label")}</p>
          <code className="block break-all rounded bg-muted px-3 py-2 text-xs">{secret}</code>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="totp-code" className="sr-only">
              {t("admin.security.code_label")}
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("admin.security.code_placeholder")}
              className="w-full rounded border px-3 py-2 text-center text-lg tracking-widest"
              autoComplete="one-time-code"
              disabled={isPending || success}
              aria-label={t("admin.security.code_label")}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="text-sm text-green-600">
              {t("admin.security.success")}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || success || code.length !== 6}
            className="w-full rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {isPending ? t("admin.security.confirming") : t("admin.security.confirm_button")}
          </button>
        </form>
      </div>
    </div>
  );
}
