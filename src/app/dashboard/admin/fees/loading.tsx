export default function FeesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border-2 border-slate-200 bg-white" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
    </div>
  );
}
