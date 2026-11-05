// AC6: admin-area loading skeleton.
export default function AdminLoading() {
  return (
    <div className="animate-pulse p-8" aria-hidden>
      <div className="mb-6 h-8 w-56 rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
