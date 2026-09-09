"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon name → Lucide component mapping.
 * The server component passes icon names as strings (serializable),
 * and the client component maps them back to the actual components.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Library,
  Megaphone,
  UserCog,
  Users,
};

export type NavItem = {
  href: string;
  label: string;
  icon: string; // icon name, not the component itself
};

/**
 * DashboardNav — sidebar navigation with active-state highlighting.
 */
export function DashboardNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((item) => {
        const active = isActive(item.href);
        const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-all",
              active
                ? "border-emerald-400 bg-emerald-500/20 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(16,185,129,0.4)]"
                : "border-transparent text-slate-300 hover:border-[#FDFBF7] hover:bg-slate-800 hover:text-[#FDFBF7]"
            )}
          >
            <Icon
              className={cn("size-4", active ? "text-emerald-400" : "")}
              strokeWidth={2.5}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
