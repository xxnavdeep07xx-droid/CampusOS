import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon name → Lucide component mapping (same pattern as DashboardNav).
 * Server components pass icon names as strings (serializable), and
 * StatCard maps them back to the actual components.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
};

/**
 * StatCard — large chunky card for the principal's analytics dashboard.
 *
 * Now accepts `icon` as a string name (e.g. "TrendingUp") instead of the
 * actual Lucide component, to avoid passing non-serializable values from
 * server to client components.
 */
export function StatCard({
  icon: iconName,
  label,
  value,
  sublabel,
  color = "bg-amber-300",
  className,
  children,
}: {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const Icon = ICON_MAP[iconName] ?? LayoutDashboard;

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
