// AC5: reads pending_signup cookie to decide whether to show the email-entry pre-step.
// AC7: signed-in users are redirected by middleware (S-033); no duplicate check here.
import { getPendingSignup } from "@/lib/auth/cookies";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";
import { AuthCard } from "@/components/auth/AuthCard";

export default async function Page() {
  const pending = await getPendingSignup();
  return <AuthCard><VerifyEmailForm pendingEmail={pending?.email ?? null} /></AuthCard>;
}
