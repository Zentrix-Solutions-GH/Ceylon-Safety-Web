import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { OwnerAlertEvent } from "@/types/audit";

// Asia/Colombo is UTC+5:30 (no DST).
const SL_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// EC2: day boundaries for a Sri Lanka calendar date string (YYYY-MM-DD).
export function slDayBoundaries(slDate: string): { startUtc: string; endUtc: string } {
  // Parse date parts from the SL local date string.
  const [year, month, day] = slDate.split("-").map(Number);
  // Start of that SL day in UTC = midnight SL - 5h30m
  const startMs = Date.UTC(year, month - 1, day) - SL_OFFSET_MS;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
  };
}

export function currentSlDate(): string {
  const nowMs = Date.now() + SL_OFFSET_MS;
  return new Date(nowMs).toISOString().slice(0, 10);
}

// Count email_logs rows sent on a given Sri Lanka calendar day.
export async function getDayEmailCount(slDate: string): Promise<number> {
  const { startUtc, endUtc } = slDayBoundaries(slDate);
  const db = createSupabaseServiceRoleClient();
  const { count, error } = await db
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);
  if (error) {
    // Fail-safe: treat a DB error as over-budget so non-security alerts are held rather than sent.
    console.error("[email-budget] getDayEmailCount error:", error.code);
    return Infinity;
  }
  return count ?? 0;
}

export async function isBudgetExceeded(): Promise<boolean> {
  const count = await getDayEmailCount(currentSlDate());
  return count >= 80;
}

// AC4: These events bypass the budget cap and are always sent.
const SECURITY_EVENTS = new Set<OwnerAlertEvent>([
  "settings.bank_details_change",
  "settings.owner_alert_email_change",
  "role.change",
  "settings.contact_change",
  "document.language_file_replace",
  "price.drop_over_50pct",
]);

export function isSecurityAlert(event: OwnerAlertEvent): boolean {
  return SECURITY_EVENTS.has(event);
}
