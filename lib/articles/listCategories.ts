import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Category } from "@/types/article";

export async function listCategories(): Promise<Category[]> {
  // Anon client: categories_public_read RLS policy allows all anon reads.
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error || !data) return [];
  return data as Category[];
}
