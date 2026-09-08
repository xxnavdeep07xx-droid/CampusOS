export default function StaffLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border-2 border-slate-200 bg-white" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
    </div>
  );
}
