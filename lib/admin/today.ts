import "server-only";

import { requireStaff } from "@/lib/auth/server";
import { writeSessionStart } from "@/lib/audit/index";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, SessionUser } from "@/types/auth";
import type { AdminTodayResult, QueueLine, BankSlipLine, TodayOrdersLine } from "@/types/admin";

// ─── Colombo day helper ───────────────────────────────────────────────────────

/**
 * Returns [start, end) in UTC ISO strings for the current Asia/Colombo calendar day.
 * Exported for unit-testing (EC3).
 */
export function todayColomboRange(): { start: string; end: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;

  // Colombo midnight in UTC: "YYYY-MM-DDT00:00:00+05:30"
  const startColombo = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  const endColombo = new Date(startColombo.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: startColombo.toISOString(),
    end: endColombo.toISOString(),
  };
}

// ─── Queue permission constants ───────────────────────────────────────────────

const QUEUE_PERMISSIONS = [
  "comments.moderate",
  "bank_transfers.review",
  "download_requests.review",
  "orders.read",
] as const;

type QueuePermission = (typeof QUEUE_PERMISSIONS)[number];

// ─── Auth: any staff with at least one queue permission ───────────────────────

/**
 * Authenticates the caller as staff with at least one queue permission.
 * Tries each permission in turn; propagates mfa_required/reauth_required immediately.
 * Returns { user, permMap } on success or { ok: false, code } on failure.
 * This avoids a "_today_sentinel" that would block all non-SA staff (P0 fix).
 */
async function requireAnyQueuePermission(): Promise<
  | { ok: true; user: SessionUser; permMap: Record<QueuePermission, boolean> }
  | { ok: false; code: string }
> {
  const permMap: Partial<Record<QueuePermission, boolean>> = {};
  let authedUser: SessionUser | null = null;

  for (const perm of QUEUE_PERMISSIONS) {
    const result = await requireStaff(perm);
    if (result.ok) {
      authedUser = result.user;
      permMap[perm] = true;
      break;
    }
    if (result.code !== "not_allowed") {
      // mfa_required or reauth_required — propagate immediately (AC6)
      return result as { ok: false; code: string };
    }
    permMap[perm] = false;
  }

  if (!authedUser) {
    return { ok: false, code: "not_allowed" };
  }

  // For the remaining permissions we haven't checked, ask the DB in parallel.
  const role = authedUser.claimedRole ?? "admin";
  if (role === "super_admin") {
    for (const p of QUEUE_PERMISSIONS) permMap[p] = true;
  } else {
    const remaining = QUEUE_PERMISSIONS.filter((p) => !(p in permMap));
    if (remaining.length > 0) {
      const supabase = await createSupabaseServerClient();
      const checks = await Promise.all(
        remaining.map((p) =>
          supabase.rpc("has_permission", { p_action: p }).then(({ data }) => ({ p, ok: !!data }))
        )
      );
      for (const { p, ok } of checks) permMap[p] = ok;
    }
  }

  return {
    ok: true,
    user: authedUser,
    permMap: permMap as Record<QueuePermission, boolean>,
  };
}

// ─── Super Admin IDs (design section 4.5) ────────────────────────────────────

/**
 * Returns the IDs of all super_admin accounts so they can be excluded from
 * queue counts visible to Admins/Maintainers (design section 4.5).
 * Uses service role to read across RLS.
 */
async function getSuperAdminIds(): Promise<string[]> {
  const { data } = await createSupabaseServiceRoleClient()
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function countComments(supabase: Supabase, saIds: string[]): Promise<QueueLine> {
  function baseQuery(table: "article_comments" | "video_comments") {
    let q = supabase.from(table).select("count, oldest:created_at.min()").eq("status", "pending");
    if (saIds.length > 0) {
      q = q.not("user_id", "in", `(${saIds.join(",")})`);
    }
    return q;
  }

  const [artResult, vidResult] = await Promise.all([
    baseQuery("article_comments"),
    baseQuery("video_comments"),
  ]);

  const artCount = (artResult.data as { count: number; oldest: string | null } | null)?.count ?? 0;
  const artOldest = (artResult.data as { count: number; oldest: string | null } | null)?.oldest ?? null;
  const vidCount = (vidResult.data as { count: number; oldest: string | null } | null)?.count ?? 0;
  const vidOldest = (vidResult.data as { count: number; oldest: string | null } | null)?.oldest ?? null;

  const count = artCount + vidCount;
  let oldestAt: string | null = null;
  if (artOldest && vidOldest) {
    oldestAt = artOldest < vidOldest ? artOldest : vidOldest;
  } else {
    oldestAt = artOldest ?? vidOldest;
  }

  return { count, oldestAt };
}

async function countBankSlips(supabase: Supabase): Promise<BankSlipLine> {
  // Both queries are independent — run concurrently.
  const [{ data: totalData }, { data: secondData }] = await Promise.all([
    supabase.from("bank_transfer_queue").select("count, oldest:created_at.min()"),
    // Second-approval count requires a filtered query on the same view (P1c fix).
    supabase.from("bank_transfer_queue").select("count").eq("awaiting_second_approval", true),
  ]);

  const total = totalData as { count: number; oldest: string | null } | null;
  const second = secondData as { count: number } | null;

  return {
    count: total?.count ?? 0,
    oldestAt: total?.oldest ?? null,
    needsSecondApproval: second?.count ?? 0,
  };
}

async function countDownloadRequests(supabase: Supabase, saIds: string[]): Promise<QueueLine> {
  let q = supabase
    .from("download_requests")
    .select("count, oldest:requested_at.min()")
    .eq("status", "pending");
  if (saIds.length > 0) {
    q = q.not("user_id", "in", `(${saIds.join(",")})`);
  }
  const { data } = await q;
  const row = data as { count: number; oldest: string | null } | null;
  return { count: row?.count ?? 0, oldestAt: row?.oldest ?? null };
}

async function countOrdersNeedingReview(supabase: Supabase): Promise<QueueLine> {
  const { data } = await supabase
    .from("orders")
    .select("count, oldest:created_at.min()")
    .eq("needs_review", true);
  const row = data as { count: number; oldest: string | null } | null;
  return { count: row?.count ?? 0, oldestAt: row?.oldest ?? null };
}

async function countTodayOrders(supabase: Supabase): Promise<TodayOrdersLine> {
  const { start, end } = todayColomboRange();
  const { data } = await supabase
    .from("orders")
    .select("count, gross:total_cents.sum()")
    .eq("status", "paid")
    .gte("paid_at", start)
    .lt("paid_at", end);
  const row = data as { count: number; gross: number | null } | null;
  return { count: row?.count ?? 0, grossCents: row?.gross ?? 0 };
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function getAdminToday(): Promise<ActionResult<AdminTodayResult>> {
  // Auth: any staff with at least one queue permission (AC1/AC2/AC6).
  const auth = await requireAnyQueuePermission();
  if (!auth.ok) return auth as ActionResult<AdminTodayResult>;

  const { user, permMap } = auth;

  const supabase = await createSupabaseServerClient();

  // AC7: write session_start audit row (at most once per actor+session).
  // Use lastFullSignIn as the stable session ID — it is set once per sign-in and
  // is constant for the duration of the staff window (up to 12 h). Using the
  // access_token would cause duplicate rows on token refresh (P1d fix).
  const sessionKey = user.lastFullSignIn ?? user.id;
  await writeSessionStart(user.id, sessionKey);

  // Fetch super_admin IDs once to exclude from counts (design section 4.5).
  const saIds = await getSuperAdminIds();

  const result: AdminTodayResult = {};
  const tasks: Promise<void>[] = [];

  if (permMap["comments.moderate"]) {
    tasks.push(countComments(supabase, saIds).then((l) => { result.comments = l; }));
  }

  if (permMap["bank_transfers.review"]) {
    tasks.push(countBankSlips(supabase).then((l) => { result.bankSlips = l; }));
  }

  if (permMap["download_requests.review"]) {
    tasks.push(countDownloadRequests(supabase, saIds).then((l) => { result.downloadRequests = l; }));
  }

  if (permMap["orders.read"]) {
    tasks.push(
      countOrdersNeedingReview(supabase).then((l) => { result.ordersNeedingReview = l; }),
      countTodayOrders(supabase).then((l) => { result.todayOrders = l; }),
    );
  }

  await Promise.all(tasks);

  return { ok: true, ...result };
}
