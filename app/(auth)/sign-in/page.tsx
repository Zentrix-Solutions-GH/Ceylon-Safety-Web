import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <SignInForm />
    </Suspense>
  );
}
