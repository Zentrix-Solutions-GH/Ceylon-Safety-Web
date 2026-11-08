import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { listPickerItemsSchema } from "@/lib/validation/video";
import type { ListPickerItemsInput, ListPickerItemsResult, PickerItem } from "@/types/video";

const PAGE_SIZE = 20;

type PickerRow = { id: string; title: string; thumbnail_key: string };

export async function listPickerItems(input: ListPickerItemsInput): Promise<ListPickerItemsResult> {
  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const parsed = listPickerItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "unknown" };

  const { search, page = 1 } = parsed.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE; // fetch PAGE_SIZE+1 to detect hasMore

  const supabase = createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("videos")
    .select("id, title, thumbnail_key")
    .eq("status", "published")
    .is("deleted_at", null)
    .lte("published_at", new Date().toISOString());

  if (search?.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error } = await query.range(from, to);

  if (error) return { ok: false, code: "unknown" };

  const rows = (data ?? []) as PickerRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const items: PickerItem[] = rows.slice(0, PAGE_SIZE).map(r => ({
    id: r.id,
    title: r.title,
    thumbnailKey: r.thumbnail_key,
    kind: "video",
  }));

  return { ok: true, items, hasMore };
}
