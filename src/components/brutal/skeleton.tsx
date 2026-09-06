/**
 * Skeleton primitives — neo-brutalist flavored (subtle pulsing border + hard
 * shadow) so loading states feel on-brand while data is being fetched.
 *
 * Used by ResourceList, AssignmentList, SubmissionsList during initial loads
 * and during file uploads.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] ${className ?? ""}`}
    >
      <div className="h-1.5 w-full animate-pulse bg-slate-200" />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-lg border-2 border-slate-200 bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t-2 border-slate-100 pt-3">
          <div className="h-2 w-20 animate-pulse rounded bg-slate-100" />
          <div className="h-6 w-20 animate-pulse rounded-lg border-2 border-slate-200 bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function InlineSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
      <span className="inline-block size-3 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      {label}
    </div>
  );
}
