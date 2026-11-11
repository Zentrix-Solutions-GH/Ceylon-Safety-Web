import { getPendingReset } from "@/lib/auth/cookies";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AuthCard } from "@/components/auth/AuthCard";

export default async function Page() {
  const pending = await getPendingReset();
  return <AuthCard><ResetPasswordForm email={pending?.email} /></AuthCard>;
}
