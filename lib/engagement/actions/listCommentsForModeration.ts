import "server-only";

import { z } from "zod";
import { unstable_noStore } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import type { ModerationState, ModerationRow, ModerationListResult } from "@/types/comment";

import { ANON_ACTOR } from "@/lib/engagement/actions/constants";

const PAGE_SIZE = 25;

const cursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

const listInputSchema = z.object({
  state: z.enum(["pending", "approved", "rejected"]).default("pending"),
  cursor: cursorSchema.optional(),
});

type ListResult =
  | ({ ok: true } & ModerationListResult)
  | { ok: false; code: "not_allowed" | "validation_failed" | "unknown" };

export async function listCommentsForModeration(
  input: unknown
): Promise<ListResult> {
  unstable_noStore();

  const auth = await requireStaff("comments.moderate");
  if (!auth.ok) {
    // actor identity is unavailable before auth succeeds; write null-actor row
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "comment",
        entityId: "",
        after: { permission: "comments.moderate" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const parsed = listInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };
  const { state, cursor } = parsed.data;

  const sb = createSupabaseServiceRoleClient();

  try {
    // Using unknown cast to avoid generated-type gaps for writer_suspended and joined columns.
    // The column exists in the DB (S-014 schema Group C); the generated types may lag.
    type RawRow = {
      id: string;
      body: string;
      status: string;
      created_at: string;
      writer_suspended: boolean | null;
      moderated_at: string | null;
      profiles: { display_name: string; deleted_at: string | null } | null;
      articles: { title: string; slug: string } | null;
      moderator: { display_name: string } | null;
    };

    type ChainWithFilters = {
      gt: (col: string, val: string) => ChainWithFilters;
      lt: (col: string, val: string) => ChainWithFilters;
      or: (filter: string) => ChainWithFilters;
      order: (col: string, opts: { ascending: boolean }) => {
        range: (from: number, to: number) => Promise<{ data: RawRow[] | null; error: unknown }>;
      };
    };

    const baseQuery = (sb
      .from("article_comments")
      .select(
        `id, body, status, created_at, writer_suspended,
         profiles:user_id ( display_name, deleted_at ),
         articles:article_id ( title, slug ),
         moderator:moderated_by ( display_name ),
         moderated_at`
      )
      .eq("status", state) as unknown) as ChainWithFilters;

    let withCursor: ChainWithFilters;
    if (cursor) {
      // Keyset pagination on (created_at, id) to handle ties on the same timestamp.
      // For ascending (pending oldest-first): rows where created_at > cursor OR
      // (created_at = cursor AND id > cursorId).
      if (state === "pending") {
        withCursor = baseQuery.or(
          `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`
        );
      } else {
        withCursor = baseQuery.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        );
      }
    } else {
      withCursor = baseQuery;
    }

    const order = state === "pending" ? { ascending: true } : { ascending: false };
    const { data, error } = await withCursor.order("created_at", order).range(0, PAGE_SIZE);

    if (error) return { ok: false, code: "unknown" };

    const rows: RawRow[] = (data ?? []).slice(0, PAGE_SIZE);
    const hasNextPage = (data ?? []).length > PAGE_SIZE;
    const comments: ModerationRow[] = rows.map((r) => ({
      id: r.id,
      body: r.body,
      status: r.status as ModerationState,
      writerDisplayName: r.profiles?.display_name ?? "Deleted user",
      writerSuspended: Boolean(r.writer_suspended),
      articleTitle: r.articles?.title ?? "",
      articleSlug: r.articles?.slug ?? "",
      createdAt: r.created_at,
      moderatorName: r.moderator?.display_name ?? null,
      moderatedAt: r.moderated_at ?? null,
    }));

    const nextCursor = hasNextPage
      ? { createdAt: comments[comments.length - 1].createdAt, id: comments[comments.length - 1].id }
      : null;

    return { ok: true, comments, nextCursor };
  } catch {
    return { ok: false, code: "unknown" };
  }
}
