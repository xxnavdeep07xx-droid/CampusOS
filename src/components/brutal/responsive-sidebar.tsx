"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, LogOut } from "lucide-react";
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
import type { NavItem } from "@/components/brutal/dashboard-nav";

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3, Building2, Bus, CalendarCheck, CalendarDays,
  ClipboardList, DollarSign, GraduationCap, LayoutDashboard,
  Library, Megaphone, UserCog, Users,
};

export function ResponsiveSidebar({
  nav,
  schoolName,
  userName,
  role,
  signOutForm,
}: {
  nav: NavItem[];
  schoolName: string | null;
  userName: string;
  role: string | null;
  signOutForm: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile sidebar when a nav link is clicked (pathname changes).
  // Using a key based on pathname so the component remounts on navigation.
  function handleNavClick() {
    setMobileOpen(false);
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <Link href="/" className="inline-flex">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="CampusOS"
              width={36}
              height={36}
              className="rounded-lg border-2 border-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(253,251,247,0.3)]"
              priority
            />
            <span className="text-lg font-black uppercase tracking-tight text-[#FDFBF7]">
              Campus<span className="text-emerald-400">OS</span>
            </span>
          </div>
        </Link>
      </div>

      {/* School badge */}
      <div className="mx-3 mb-3 rounded-xl border-2 border-[#FDFBF7]/30 bg-slate-800 px-3 py-2.5 shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          School
        </div>
        <div className="mt-0.5 truncate text-sm font-bold text-[#FDFBF7]">
          {schoolName ?? "—"}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 overflow-y-auto">
        {nav.map((item) => {
          const active = isActive(item.href);
          const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "group flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-all",
                active
                  ? "border-emerald-400 bg-emerald-500/20 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(16,185,129,0.4)]"
                  : "border-transparent text-slate-300 hover:border-[#FDFBF7] hover:bg-slate-800 hover:text-[#FDFBF7]"
              )}
            >
              <Icon
                className={cn("size-4 shrink-0", active ? "text-emerald-400" : "")}
                strokeWidth={2.5}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User badge + sign out */}
      <div className="border-t-2 border-slate-800 px-3 py-3 shrink-0">
        <div className="rounded-xl border-2 border-[#FDFBF7]/20 bg-slate-800 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Signed in as
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-[#FDFBF7]">
            {userName}
          </div>
          <div className="mt-1 inline-flex rounded-full border-2 border-[#FDFBF7]/30 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            {role ?? "no role"}
          </div>
        </div>
        {signOutForm}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="flex items-center justify-between border-b-[3px] border-slate-900 bg-slate-900 px-4 py-3 md:hidden">
        <Link href="/" className="inline-flex">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="CampusOS"
              width={28}
              height={28}
              className="rounded border-2 border-[#FDFBF7]"
            />
            <span className="text-sm font-black uppercase tracking-tight text-[#FDFBF7]">
              Campus<span className="text-emerald-400">OS</span>
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 text-[#FDFBF7] transition-all hover:bg-slate-700"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Desktop sidebar (always visible on md+) */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r-[3px] border-slate-900 bg-slate-900 text-[#FDFBF7] md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sliding panel */}
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col overflow-y-auto border-r-[3px] border-slate-900 bg-slate-900 text-[#FDFBF7] shadow-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 text-[#FDFBF7] transition-all hover:bg-rose-500"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
