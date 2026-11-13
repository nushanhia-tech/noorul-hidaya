/** Lightweight loading placeholders shown instantly while server data loads. */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-sand ${className}`} />;
}

export function PortalPageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-fade-in">
      <span className="sr-only">Loading…</span>
      <Bar className="mb-2 h-4 w-32" />
      <Bar className="mb-8 h-8 w-72 max-w-full" />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="rounded-md border border-line bg-paper p-5"><Bar className="mb-5 h-3 w-24" /><Bar className="h-7 w-20" /></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {[0, 1].map((c) => (
          <div key={c} className="rounded-md border border-line bg-paper">
            <div className="border-b border-line px-5 py-4"><Bar className="h-4 w-40" /></div>
            <div className="space-y-4 px-5 py-5">{[0, 1, 2, 3].map((i) => <Bar key={i} className="h-4 w-full" />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicPageSkeleton() {
  return (
    <div aria-busy="true" className="animate-fade-in">
      <span className="sr-only">Loading…</span>
      <div className="border-b border-line bg-ivory">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20"><Bar className="mb-4 h-4 w-28" /><Bar className="h-12 w-96 max-w-full" /><Bar className="mt-5 h-4 w-[32rem] max-w-full" /></div>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-5 px-5 py-14 sm:px-8 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="rounded-md border border-line bg-paper p-6"><Bar className="mb-3 h-4 w-20" /><Bar className="mb-2 h-6 w-3/4" /><Bar className="h-4 w-full" /></div>)}
      </div>
    </div>
  );
}
