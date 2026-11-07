import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { BillingAddress } from "@/types/user";

export default async function Page() {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    redirect("/sign-in");
  }

  const user = userData.user;

  // Fetch profile row
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, display_name, phone, company_name, billing_address")
    .eq("id", user.id)
    .single();

  // Google-only: no identity with provider "email"
  const isGoogleOnly = !(user.identities ?? []).some((i) => i.provider === "email");

  // Staff check: JWT claim (may be ~1 hour stale; sufficient for hide-button decision)
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  const isStaff = Boolean(appMeta?.user_role);

  return (
    <div className="container max-w-2xl py-10 px-4">
      <ProfileForm
        profile={{
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null,
          displayName: profile?.display_name ?? "",
          phone: profile?.phone ?? null,
          companyName: profile?.company_name ?? null,
          billingAddress: (profile?.billing_address as BillingAddress | null) ?? null,
        }}
        isGoogleOnly={isGoogleOnly}
        isStaff={isStaff}
      />
    </div>
  );
}
