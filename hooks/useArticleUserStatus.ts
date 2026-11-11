"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type UserStatus = "loading" | "signed-out" | "active" | "suspended";

export function useArticleUserStatus(): UserStatus {
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) { setUserStatus("signed-out"); return; }
      const status = (user.app_metadata?.account_status as string | undefined) ?? "active";
      setUserStatus(status === "suspended" ? "suspended" : "active");
    });
  }, []);
  return userStatus;
}
