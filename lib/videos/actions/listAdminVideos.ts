import "server-only";
import { unstable_noStore } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { listAdminVideosSchema } from "@/lib/validation/video";
import { mapRow, type VideoRow } from "@/lib/videos/mapRow";
import type {
  ListAdminVideosInput,
  ListAdminVideosResult,
  AdminVideoRow,
  VideoStatus,
} from "@/types/video";

const PAGE_SIZE = 25;

function computeStatus(row: VideoRow): VideoStatus | "scheduled" {
  if (row.status === "published" && row.published_at && new Date(row.published_at) > new Date()) {
    return "scheduled";
  }
  return row.status as VideoStatus;
}

export async function listAdminVideos(input: ListAdminVideosInput): Promise<ListAdminVideosResult> {
  unstable_noStore();

  const auth = await requireStaff("videos.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const parsed = listAdminVideosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "unknown" };

  const { status, page = 1 } = parsed.data;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  const supabase = createSupabaseServiceRoleClient();

  // Build query — deleted_at IS NULL always (admin list never shows deleted)
  let query = supabase
    .from("videos")
    .select("id, youtube_id, title, description, category_id, thumbnail_key, thumbnail_source, locale, status, published_at, updated_at, created_at")
    .is("deleted_at", null);

  // Status filter: "scheduled" maps to published rows where published_at > now().
  // Push the date guard to the DB so pagination is accurate.
  const q = query as typeof query & {
    eq: (col: string, val: string) => typeof query;
    gt: (col: string, val: string) => typeof query;
    lte: (col: string, val: string) => typeof query;
  };
  if (status && status !== "scheduled") {
    query = q.eq("status", status);
  } else if (status === "scheduled") {
    query = q.eq("status", "published").gt("published_at", new Date().toISOString());
  }

  const { data, error } = await (
    query as typeof query & {
      order: (col: string, opts: { ascending: boolean }) => typeof query;
      range: (a: number, b: number) => typeof query;
    }
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { ok: false, code: "unknown" };

  const rows = (data ?? []) as VideoRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const slice = rows.slice(0, PAGE_SIZE);

  const videos: AdminVideoRow[] = slice.map(row => ({
    ...mapRow(row),
    computedStatus: computeStatus(row),
  }));

  const filtered = videos;

  return { ok: true, videos: filtered, hasMore };
}
