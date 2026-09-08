/**
 * Dashboard loading skeleton — shown instantly while the server component
 * fetches the principal's data (profile, school, invitations, stats).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border-2 border-slate-200 bg-white"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Invite cards skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border-2 border-slate-200 bg-white"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Recent activity skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border-2 border-slate-200 bg-white"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
