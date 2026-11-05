// AC6: public-area loading skeleton — matches the height of the real content area.
// No layout jump: height matches the Header (4rem) already rendered above this file.
export default function PublicLoading() {
  return (
    <>
      <span role="status" className="sr-only">Loading…</span>
      <div className="container mx-auto animate-pulse px-4 py-8" aria-hidden>
      {/* Hero-area skeleton */}
      <div className="mb-6 h-64 rounded-lg bg-muted" />
      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <div className="h-40 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
