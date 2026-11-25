import { t } from "@/messages/en";

export function formatRelativeAge(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return t("admin.today.age_just_now");
  if (diffMins < 60) return `${diffMins}${t("admin.today.age_minutes_suffix")}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}${t("admin.today.age_hours_suffix")}`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}${t("admin.today.age_days_suffix")}`;
}
