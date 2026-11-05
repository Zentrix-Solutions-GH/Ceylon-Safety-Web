import "server-only";
import { unstable_noStore } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  AdminArticleListInput,
  AdminArticleListResponse,
  AdminArticleRow,
} from "@/types/article";

const PAGE_SIZE = 25;

export async function listAdminArticles(
  input: AdminArticleListInput
): Promise<AdminArticleListResponse> {
  unstable_noStore();

  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const supabase = createSupabaseServiceRoleClient();
  const { status, category, title, page = 1 } = input;

  const now = new Date().toISOString();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("articles")
    .select(
      `id, slug, title, status, published_at, updated_at,
       categories!inner(name, slug),
       authors!inner(name)`,
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (status === "scheduled") {
    // published rows with a future published_at (published_at > now)
    query = query.eq("status", "published").not("published_at", "is", null).gt("published_at", now);
  } else if (status === "published") {
    query = query.eq("status", "published").lte("published_at", now);
  } else if (status) {
    query = query.eq("status", status);
  }

  if (category) {
    query = query.eq("categories.slug", category);
  }

  if (title) {
    query = query.ilike("title", `%${title}%`);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error || !data) {
    console.error("[listAdminArticles] db error:", error?.code ?? "unknown");
    return { ok: false, code: "unknown" };
  }

  const items: AdminArticleRow[] = data.map((r) => {
    const isScheduled =
      r.status === "published" &&
      r.published_at &&
      new Date(r.published_at as string) > new Date();
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      status: isScheduled ? "scheduled" : (r.status as AdminArticleRow["status"]),
      categorySlug: (r.categories as unknown as { slug: string }).slug,
      categoryName: (r.categories as unknown as { name: string }).name,
      authorName: (r.authors as unknown as { name: string }).name,
      updatedAt: r.updated_at as string,
    };
  });

  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return { ok: true, data: { items, pageCount } };
}
