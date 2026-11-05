// AC6: customer-area loading skeleton.
import { t } from "@/messages/en";

export default function CustomerLoading() {
  return (
    <>
      <span role="status" className="sr-only">{t("loading.message")}</span>
      <div className="container mx-auto animate-pulse px-4 py-8" aria-hidden>
      <div className="mb-4 h-8 w-48 rounded bg-muted" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <div className="h-12 w-12 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-4 w-1/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
