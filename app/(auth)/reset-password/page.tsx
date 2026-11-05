import { getPendingReset } from "@/lib/auth/cookies";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function Page() {
  const pending = await getPendingReset();
  return <ResetPasswordForm email={pending?.email} />;
}
