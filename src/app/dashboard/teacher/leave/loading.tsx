export default function LeaveLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
        <div className="h-64 animate-pulse rounded-xl border-2 border-slate-200 bg-white" />
      </div>
    </div>
  );
}
