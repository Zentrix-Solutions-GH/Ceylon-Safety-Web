import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireStaffNoMfa } from "@/lib/auth/server";
import { startMFAEnrolment } from "@/lib/admin/actions/mfa-enrolment";
import { safeNext } from "@/lib/auth/redirect";
import { t } from "@/messages/en";
import SecurityPageClient from "./SecurityPageClient";

export const metadata: Metadata = {
  title: "Set up authenticator — CeylonSafety Admin",
  robots: { index: false, follow: false },
};

// AC5: no ad/analytics scripts — this page is inside (admin) group which has
// no ScriptGate; the layout has no third-party scripts.

export default async function SecurityPage() {
  // AC2: requires staff claim, NOT authenticator level
  const auth = await requireStaffNoMfa();
  if (!auth.ok) {
    // Middleware handles the redirect; server component returns nothing on auth failure.
    return null;
  }

  // AC2: already enrolled — show message, skip QR
  if (auth.user.hasTotpEnrolled) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {t("admin.security.already_enrolled")}
        </p>
      </div>
    );
  }

  // AC1: read the pending-redirect cookie set by middleware before the redirect
  const jar = await cookies();
  const nextUrl = safeNext(jar.get("next")?.value);

  // Start enrolment server-side so the TOTP URI never touches the browser URL
  const enrolment = await startMFAEnrolment();

  if (!enrolment.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-destructive">
          {t("errors.unknown")}
        </p>
      </div>
    );
  }

  // EC2: uri and secret passed to client; QR code rendered client-side
  return (
    <SecurityPageClient
      factorId={enrolment.factorId}
      uri={enrolment.uri}
      secret={enrolment.secret}
      next={nextUrl}
    />
  );
}
