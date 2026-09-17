export default function DirectoryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-white p-3">
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b-2 border-slate-100 px-4 py-3">
            <div className="size-10 animate-pulse rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-2.5 w-56 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
