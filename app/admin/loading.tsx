// AC6: admin-area loading skeleton.
import { t } from "@/messages/en";

export default function AdminLoading() {
  return (
    <>
      <span role="status" className="sr-only">{t("loading.message")}</span>
      <div className="animate-pulse p-8" aria-hidden={true}>
      <div className="mb-6 h-8 w-56 rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted" />
        ))}
      </div>
    </div>
    </>
  );
}
