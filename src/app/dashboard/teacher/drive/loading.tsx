export default function DriveLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-white p-3">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border-2 border-slate-200 bg-white" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}
