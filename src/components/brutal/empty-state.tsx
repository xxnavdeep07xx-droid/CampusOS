import { cn } from "@/lib/utils";

/**
 * EmptyState — shared component for "no data" states across the app.
 *
 * Provides a consistent visual pattern: icon in a colored brutalist box,
 * bold title, helpful subtitle, and optional CTA link.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Inbox className="size-6 text-slate-900" />}
 *     title="No submissions waiting"
 *     subtitle="All caught up — nice work."
 *     color="bg-emerald-200"
 *   />
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  color = "bg-amber-200",
  className,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]",
          color
        )}
      >
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      {subtitle && (
        <p className="mt-1 text-xs font-medium text-slate-600">{subtitle}</p>
      )}
      {ctaHref && ctaLabel && (
        <a
          href={ctaHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-amber-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
