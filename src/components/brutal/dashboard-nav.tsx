"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * DashboardNav — the sidebar navigation with active-state highlighting.
 *
 * The currently selected route is highlighted with an emerald border +
 * emerald background so the user always knows where they are.
 */
export function DashboardNav({
  nav,
}: {
  nav: Array<{ href: string; label: string; icon: LucideIcon }>;
}) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    // Exact match for /dashboard, starts-with for everything else.
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
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
