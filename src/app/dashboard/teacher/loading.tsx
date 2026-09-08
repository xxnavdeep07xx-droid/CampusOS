export default function TeacherLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-48 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border-2 border-slate-200 bg-white" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}
