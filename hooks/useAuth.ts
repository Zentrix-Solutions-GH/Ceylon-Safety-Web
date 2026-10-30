"use client";

// AC6: display-only — name and signed-in state. Never used for access decisions.
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    // EC1: any error → treat as signed out.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (mounted) setUser(session ? extractUser(session.user) : null);
      })
      .catch(() => { if (mounted) setUser(null); })
      .finally(() => { if (mounted) setIsLoading(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session ? extractUser(session.user) : null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    // EC5: signOut returns { error } rather than throwing — surface it so callers can catch it.
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
