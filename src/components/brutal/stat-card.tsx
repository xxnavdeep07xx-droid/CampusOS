import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * StatCard — large chunky card for the principal's analytics dashboard.
 *
 * Each card has a vibrant bg-* class (passed via `color`) + a thick black
 * border + hard offset shadow. The big number uses font-black uppercase.
 *
 * Suggested color values per the Phase 3 spec:
 *   - Yellow card for students (bg-amber-300)
 *   - Blue card for attendance (bg-sky-300)
 *   - Violet card for teachers (bg-violet-400)
 *   - Emerald card for classes (bg-emerald-400)
 *   - Coral card for low attendance alerts (bg-rose-400)
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color = "bg-amber-300",
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-[3px] border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] brutal-hover",
        color,
        className
      )}
    >
      {/* Decorative hatch overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #0f172a 0px, #0f172a 1.5px, transparent 1.5px, transparent 12px)",
        }}
      />

      <div className="relative p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-900/80">
            {label}
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Icon className="size-5 text-slate-900" strokeWidth={2.5} />
          </div>
        </div>

        <div className="mt-3 text-4xl font-black uppercase leading-none tracking-tight text-slate-900 md:text-5xl">
          {value}
        </div>

        {sublabel && (
          <div className="mt-1.5 text-xs font-bold uppercase tracking-wider text-slate-800/70">
            {sublabel}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
