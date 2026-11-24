import "server-only";

import { unstable_noStore as noStore } from "next/cache";

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
          supabase.rpc("has_permission", { p_action: p }).then(({ data, error }) => ({ p, ok: !error && !!data }))
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

// ─── Super Admin IDs with 5-minute cache (design section 4.5) ────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let _saIdCache: { ids: string[]; expiresAt: number } | null = null;

/**
 * Returns the IDs of all super_admin accounts so they can be excluded from
 * queue counts visible to Admins/Maintainers (design section 4.5).
 * Uses service role to read across RLS. Cached for 5 minutes (super_admin
 * membership changes rarely; avoids a service-role round-trip on every request).
 */
async function getSuperAdminIds(): Promise<string[]> {
  const now = Date.now();
  if (_saIdCache && _saIdCache.expiresAt > now) return _saIdCache.ids;
  const { data, error } = await createSupabaseServiceRoleClient()
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  if (error) {
    console.error("[getSuperAdminIds] failed:", error);
    return _saIdCache?.ids ?? []; // return stale cache on error rather than caching empty
  }
  const ids = (data ?? [])
    .map((r: { user_id: string }) => r.user_id)
    .filter((id: string) => UUID_RE.test(id));
  _saIdCache = { ids, expiresAt: now + 5 * 60 * 1000 };
  return ids;
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function countComments(supabase: Supabase, saIds: string[]): Promise<QueueLine> {
  function countQ(table: "article_comments" | "video_comments") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select("id", { count: "exact", head: true }).eq("status", "pending");
    if (saIds.length > 0) q = q.not("user_id", "in", `(${saIds.join(",")})`);
    return q as Promise<{ count: number | null; error: unknown }>;
  }
  function oldestQ(table: "article_comments" | "video_comments") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select("created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(1);
    if (saIds.length > 0) q = q.not("user_id", "in", `(${saIds.join(",")})`);
    return q.maybeSingle() as Promise<{ data: { created_at: string } | null; error: unknown }>;
  }

  const [artCnt, artOld, vidCnt, vidOld] = await Promise.all([
    countQ("article_comments"),
    oldestQ("article_comments"),
    countQ("video_comments"),
    oldestQ("video_comments"),
  ]);

  const count = (artCnt.count ?? 0) + (vidCnt.count ?? 0);
  const artOldestAt = artOld.data?.created_at ?? null;
  const vidOldestAt = vidOld.data?.created_at ?? null;
  let oldestAt: string | null = null;
  if (artOldestAt && vidOldestAt) {
    oldestAt = artOldestAt < vidOldestAt ? artOldestAt : vidOldestAt;
  } else {
    oldestAt = artOldestAt ?? vidOldestAt;
  }

  return { count, oldestAt };
}

async function countBankSlips(): Promise<BankSlipLine> {
  // bank_transfer_queue has REVOKE ALL FROM authenticated — must use service role.
  // The view is already scoped to o.status = 'pending_verification' (migration
  // 20261118000002_bank-transfer-approval.sql:81) — no extra status filter needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sr: any = createSupabaseServiceRoleClient();
  const [cntRes, oldRes, secRes] = await Promise.all([
    sr.from("bank_transfer_queue").select("id", { count: "exact", head: true }) as Promise<{ count: number | null; error: unknown }>,
    sr.from("bank_transfer_queue").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle() as Promise<{ data: { created_at: string } | null; error: unknown }>,
    sr.from("bank_transfer_queue").select("id", { count: "exact", head: true }).eq("awaiting_second_approval", true) as Promise<{ count: number | null; error: unknown }>,
  ]);

  return {
    count: cntRes.count ?? 0,
    oldestAt: oldRes.data?.created_at ?? null,
    needsSecondApproval: secRes.count ?? 0,
  };
}

async function countDownloadRequests(supabase: Supabase, saIds: string[]): Promise<QueueLine> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQ: any = supabase.from("download_requests").select("id", { count: "exact", head: true }).eq("status", "open");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let oldestQ: any = supabase.from("download_requests").select("requested_at").eq("status", "open").order("requested_at", { ascending: true }).limit(1);
  if (saIds.length > 0) {
    const csv = `(${saIds.join(",")})`;
    countQ = countQ.not("user_id", "in", csv);
    oldestQ = oldestQ.not("user_id", "in", csv);
  }
  const [cntRes, oldRes] = await Promise.all([
    countQ as Promise<{ count: number | null; error: unknown }>,
    oldestQ.maybeSingle() as Promise<{ data: { requested_at: string } | null; error: unknown }>,
  ]);
  return { count: cntRes.count ?? 0, oldestAt: oldRes.data?.requested_at ?? null };
}

async function countOrdersNeedingReview(supabase: Supabase): Promise<QueueLine> {
  const [cntRes, oldRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("orders").select("id", { count: "exact", head: true }).eq("needs_review", true) as any) as Promise<{ count: number | null; error: unknown }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("orders").select("created_at").eq("needs_review", true).order("created_at", { ascending: true }).limit(1).maybeSingle() as any) as Promise<{ data: { created_at: string } | null; error: unknown }>,
  ]);
  return { count: cntRes.count ?? 0, oldestAt: oldRes.data?.created_at ?? null };
}

async function countTodayOrders(supabase: Supabase): Promise<TodayOrdersLine> {
  const { start, end } = todayColomboRange();
  // Count uses the standard pattern; gross uses the aggregate column (no equivalent in head mode).
  const [cntRes, sumRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").gte("paid_at", start).lt("paid_at", end) as any) as Promise<{ count: number | null; error: unknown }>,
    supabase.from("orders").select("gross:total_cents.sum()").eq("status", "paid").gte("paid_at", start).lt("paid_at", end),
  ]);
  type SumRow = { gross: number | null };
  if (sumRes.error) console.error("[countTodayOrders] aggregate failed:", sumRes.error);
  const sumRow = (sumRes.data as SumRow[] | null)?.[0] ?? null;
  return { count: cntRes.count ?? 0, grossCents: sumRow?.gross ?? 0 };
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function getAdminToday(): Promise<ActionResult<AdminTodayResult>> {
  noStore(); // AC3: counts must never be served from the Next.js data cache
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
  // Audit failure must not block the read — catch and swallow.
  try { await writeSessionStart(user.id, sessionKey); } catch (e) { console.error("[getAdminToday] writeSessionStart failed:", e); }

  // Fetch super_admin IDs once to exclude from counts (design section 4.5).
  const saIds = await getSuperAdminIds();

  const result: AdminTodayResult = {};
  const tasks: Promise<void>[] = [];

  if (permMap["comments.moderate"]) {
    tasks.push(countComments(supabase, saIds).then((l) => { result.comments = l; }));
  }

  if (permMap["bank_transfers.review"]) {
    tasks.push(countBankSlips().then((l) => { result.bankSlips = l; }));
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
