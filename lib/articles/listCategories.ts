import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Category } from "@/types/article";

export async function listCategories(): Promise<Category[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error || !data) return [];
  return data as Category[];
}
