import { t } from "@/messages/en";
import type { Counters as CountersData } from "@/types/api";

interface CountersProps {
  data: CountersData;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-LK").format(value) + "+";
}

const COUNTER_KEYS: Array<{
  field: keyof CountersData;
  labelKey: "home.counter.articles" | "home.counter.documents" | "home.counter.users" | "home.counter.downloads";
}> = [
  { field: "articles", labelKey: "home.counter.articles" },
  { field: "documents", labelKey: "home.counter.documents" },
  { field: "users", labelKey: "home.counter.users" },
  { field: "downloads", labelKey: "home.counter.downloads" },
];

export function Counters({ data }: CountersProps) {
  const visible = COUNTER_KEYS.filter(({ field }) => {
    const v = data[field];
    return v !== null && v >= 10;
  });

  if (visible.length === 0) return null;

  return (
    <section aria-label={t("home.counters_label")} className="py-8">
      <dl className="flex flex-wrap justify-center gap-8 text-center">
        {visible.map(({ field, labelKey }) => {
          const value = data[field] as number;
          return (
            <div key={field} className="flex flex-col items-center gap-1">
              <dt className="text-sm text-gray-500">{t(labelKey)}</dt>
              <dd className="text-2xl font-bold text-gray-900">{formatCount(value)}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
