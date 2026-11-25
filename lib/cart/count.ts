import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCartCount(userId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return count ?? 0;
  } catch {
    return 0;
  }
}
