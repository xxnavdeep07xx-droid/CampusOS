import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Library,
  LogOut,
  Megaphone,
  UserCog,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCachedProfile, getCachedSchool, getCachedNotices } from "@/lib/cached-queries";
import { GlobalNoticeBanner } from "@/components/brutal/global-notice-banner";
import { DashboardNav } from "@/components/brutal/dashboard-nav";
import { signOutAction } from "@/app/login/actions";
import type { Profile, UserRole, GlobalNotice } from "@/lib/types";
import Image from "next/image";

// Revalidate the layout every 30 seconds (stale-while-revalidate).
export const revalidate = 30;

/**
 * DashboardLayout — the authenticated app shell.
 *
 * Uses cached fetchers (getCachedProfile, getCachedSchool, getCachedNotices)
 * to reduce Supabase round-trips. The layout itself is revalidated every
 * 30s via Next.js ISR.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use cached fetchers for profile + school + notices.
  const profile = await getCachedProfile(user.id);
  const schoolId = profile?.school_id ?? "";

  const [school, notices] = await Promise.all([
    schoolId ? getCachedSchool(schoolId) : Promise.resolve(null),
    schoolId ? getCachedNotices(schoolId) : Promise.resolve([] as GlobalNotice[]),
  ]);
  const role: UserRole | null = (profile as Profile | null)?.role ?? null;

  // Build the nav based on role.
  const nav = buildNav(role);

  return (
    <div className="flex h-screen flex-col bg-[#FDFBF7] overflow-hidden">
      {/* Global notice banner — at the very top, above the sidebar */}
      <GlobalNoticeBanner notices={notices} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — fixed, scrolls independently */}
        <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r-[3px] border-slate-900 bg-slate-900 text-[#FDFBF7]">
          <div className="px-5 py-5">
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

          <div className="mx-3 mb-3 rounded-xl border-2 border-[#FDFBF7]/30 bg-slate-800 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              School
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-[#FDFBF7]">
              {school?.name ?? "—"}
            </div>
          </div>

          <DashboardNav nav={nav} />

          <div className="border-t-2 border-slate-800 px-3 py-3">
            <div className="rounded-xl border-2 border-[#FDFBF7]/20 bg-slate-800 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Signed in as
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-[#FDFBF7]">
                {(profile as Profile | null)?.full_name || user.email}
              </div>
              <div className="mt-1 inline-flex rounded-full border-2 border-[#FDFBF7]/30 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                {role ?? "no role"}
              </div>
            </div>

            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#FDFBF7] transition-all hover:border-rose-400 hover:bg-rose-500 hover:text-slate-900"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Content — scrolls independently from the sidebar */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b-[3px] border-slate-900 bg-[#FDFBF7]">
            <div className="flex items-center justify-between px-5 py-3 md:px-8">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Dashboard
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildNav(role: UserRole | null) {
  const common = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: "LayoutDashboard" as const,
    },
  ];

  if (role === "principal" || role === "staff") {
    return [
      ...common,
      { href: "/dashboard/staff", label: "Staff & Teachers", icon: "Users" as const },
      { href: "/dashboard/classes", label: "All Classes", icon: "Building2" as const },
      { href: "/dashboard/admin/fees", label: "Fees", icon: "DollarSign" as const },
      { href: "/dashboard/admin/notices", label: "Notices", icon: "Megaphone" as const },
      { href: "/dashboard/admin/library", label: "Library", icon: "Library" as const },
      { href: "/dashboard/admin/hr", label: "HR / Leave", icon: "ClipboardList" as const },
      { href: "/dashboard/admin/transport", label: "Transport", icon: "Bus" as const },
      { href: "/dashboard/teacher/schedule", label: "School Schedule", icon: "CalendarDays" as const },
    ];
  }
  if (role === "teacher") {
    return [
      ...common,
      { href: "/dashboard/teacher", label: "My Classes", icon: "GraduationCap" as const },
      { href: "/dashboard/teacher/schedule", label: "My Schedule", icon: "CalendarDays" as const },
      { href: "/dashboard/teacher/leave", label: "Leave Requests", icon: "ClipboardList" as const },
      { href: "/dashboard/students", label: "My Students", icon: "UserCog" as const },
    ];
  }
  if (role === "student") {
    return [
      ...common,
      { href: "/dashboard/classes", label: "My Class", icon: "Building2" as const },
      { href: "/dashboard/library", label: "Library", icon: "Library" as const },
      { href: "/dashboard/transport", label: "Transport", icon: "Bus" as const },
      { href: "/dashboard/attendance", label: "My Attendance", icon: "CalendarCheck" as const },
      { href: "/dashboard/schedule", label: "My Schedule", icon: "CalendarDays" as const },
      { href: "/dashboard/grades", label: "My Grades", icon: "BarChart3" as const },
    ];
  }
  if (role === "parent") {
    return [
      ...common,
      { href: "/dashboard/parent", label: "My Children", icon: "Users" as const },
      { href: "/dashboard/parent/fees", label: "Fees & Payments", icon: "DollarSign" as const },
    ];
  }
  return common;
}
