export default function ScheduleLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-96 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
