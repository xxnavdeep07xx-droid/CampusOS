import { Skeleton } from "@/components/ui/skeleton";

export default function GradingQueueLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex gap-3 rounded-xl border-2 border-slate-900 bg-white p-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
