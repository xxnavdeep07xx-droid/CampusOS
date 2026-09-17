export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-white p-3">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b-2 border-slate-200 bg-slate-900">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="px-2 py-1.5">
                <div className="mx-auto h-3 w-8 animate-pulse rounded bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {[...Array(35)].map((_, i) => (
              <div
                key={i}
                className="min-h-[88px] border-b-[1px] border-r-[1px] border-slate-200 p-1.5"
                style={{ animationDelay: `${(i % 7) * 40}ms` }}
              >
                <div className="size-6 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border-2 border-slate-200 bg-white p-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
