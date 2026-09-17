export default function MessagesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:h-[calc(100vh-220px)]">
        <div className="rounded-xl border-2 border-slate-200 bg-white">
          <div className="border-b-2 border-slate-200 bg-slate-900 px-4 py-2.5">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-700" />
          </div>
          <div className="space-y-3 p-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
                  <div className="h-2.5 w-48 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white">
          <div className="size-12 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
