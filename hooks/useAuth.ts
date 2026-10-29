"use client";

// AC6: display-only — name and signed-in state. Never used for access decisions.
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthUser = {
  name: string | null;
};

export type UseAuthResult = {
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // EC1: any error → treat as signed out.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session ? extractUser(session.user) : null);
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? extractUser(session.user) : null);
      setIsLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  return { user, isLoading, signOut };
}

function extractUser(raw: { user_metadata?: Record<string, unknown> }): AuthUser {
  // EC2: name may be absent — caller shows "Account" when null.
  const name =
    (raw.user_metadata?.full_name as string | undefined) ??
    (raw.user_metadata?.name as string | undefined) ??
    null;
  return { name };
}
