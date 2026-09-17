export default function GradingQueueLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-72 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex gap-3 rounded-xl border-2 border-slate-900 bg-white p-3">
        <div className="h-10 flex-1 animate-pulse rounded bg-slate-200" />
        <div className="h-10 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 w-full animate-pulse rounded-xl border-2 border-slate-200 bg-white"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
