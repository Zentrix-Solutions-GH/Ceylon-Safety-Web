import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireStaffNoMfa } from "@/lib/auth/server";
import { safeNext } from "@/lib/auth/redirect";
import MfaPageClient from "./MfaPageClient";

export const metadata: Metadata = {
  title: "Two-factor authentication — CeylonSafety Admin",
  robots: { index: false, follow: false },
};

// AC5: no ad/analytics scripts — admin layout has none.

export default async function MfaPage() {
  // AC4: requires staff claim, NOT authenticator level
  const auth = await requireStaffNoMfa();
  if (!auth.ok) {
    redirect("/sign-in");
  }

  // AC4: no TOTP enrolled → redirect to enrolment page
  if (!auth.user.hasTotpEnrolled) {
    redirect("/admin/security");
  }

  // EC1: already at authenticator level → middleware redirects before we get here,
  // but guard defensively in case of a direct navigation.
  if (auth.user.hasAuthenticatorLevel) {
    redirect("/admin/dashboard");
  }

  // AC3: read the pending-redirect cookie set by middleware before the redirect
  const jar = await cookies();
  const nextUrl = safeNext(jar.get("next")?.value);

  return <MfaPageClient next={nextUrl} />;
}
