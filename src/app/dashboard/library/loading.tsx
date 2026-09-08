export default function LibraryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl border-2 border-slate-200 bg-white" style={{ animationDelay: `${i * 30}ms` }} />
        ))}
      </div>
    </div>
  );
}
