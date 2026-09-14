import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/lucide-icons";

/**
 * StatCard — large chunky card for dashboards.
 * `size`: "lg" (default) for principal dashboard, "sm" for staff list.
 */
export function StatCard({
  icon: iconName,
  label,
  value,
  sublabel,
  color = "bg-amber-300",
  size = "lg",
  className,
}: {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const isSm = size === "sm";
  const Icon = getIcon(iconName);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-[3px] border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] brutal-hover",
        color,
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #0f172a 0px, #0f172a 1.5px, transparent 1.5px, transparent 12px)",
        }}
      />

      <div className={cn("relative", isSm ? "p-3" : "p-5 md:p-6")}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-900/80">
            {label}
          </div>
          <div className={cn(
            "flex items-center justify-center rounded-xl border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
            isSm ? "size-7" : "size-10"
          )}>
            <Icon className={isSm ? "size-3.5 text-slate-900" : "size-5 text-slate-900"} strokeWidth={2.5} />
          </div>
        </div>

        <div className={cn(
          "mt-3 font-black uppercase leading-none tracking-tight text-slate-900",
          isSm ? "text-2xl" : "text-4xl md:text-5xl"
        )}>
          {value}
        </div>

        {sublabel && (
          <div className={cn(
            "mt-1.5 font-bold uppercase tracking-wider text-slate-800/70",
            isSm ? "text-[9px]" : "text-xs"
          )}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
