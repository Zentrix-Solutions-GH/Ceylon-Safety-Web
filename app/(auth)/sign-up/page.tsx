// AC7: signed-in users are redirected by middleware (S-033); no duplicate check here.
import { SignUpForm } from "@/components/auth/SignUpForm";

export default function Page() {
  return <SignUpForm />;
}
