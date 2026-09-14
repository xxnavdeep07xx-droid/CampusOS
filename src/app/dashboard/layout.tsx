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
import { GlobalNoticeBanner } from "@/components/brutal/global-notice-banner";
import { ResponsiveSidebar } from "@/components/brutal/responsive-sidebar";
import { signOutAction } from "@/app/login/actions";
import type { Profile, UserRole, GlobalNotice } from "@/lib/types";

/**
 * DashboardLayout — the authenticated app shell.
 *
 * This layout MUST be dynamic (not ISR) because it reads the user's session
 * cookie via supabase.auth.getUser(). Do NOT add `export const revalidate`
 * — it will cause serialization errors when Next.js tries to cache the
 * rendered output (server actions + JSX elements can't be serialized for ISR).
 */
export const dynamic = "force-dynamic";

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

  // Fetch profile, school, and notices in parallel for performance.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = profileRow as Profile | null;
  const schoolId = profile?.school_id ?? "";

  const [
    { data: school },
    { data: noticeRows },
  ] = await Promise.all([
    schoolId
      ? supabase.from("schools").select("id, name, principal_id").eq("id", schoolId).single()
      : Promise.resolve({ data: null }),
    schoolId
      ? supabase
          .from("global_notices")
          .select("*")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .lte("publish_date", new Date().toISOString().slice(0, 10))
          .order("publish_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
  ]);

  const notices = (noticeRows ?? []) as unknown as GlobalNotice[];
  const role: UserRole | null = (profile as Profile | null)?.role ?? null;

  // Build the nav based on role + staff sub-role.
  const staffRole = (profile as Profile & { staff_role?: string | null } | null)?.staff_role ?? null;
  const nav = buildNav(role, staffRole);

  return (
    <div className="flex h-screen flex-col bg-[#FDFBF7] overflow-hidden">
      {/* Global notice banner */}
      <GlobalNoticeBanner notices={notices} />

      <div className="flex flex-1 overflow-hidden">
        <ResponsiveSidebar
          nav={nav}
          schoolName={school?.name ?? null}
          userName={(profile as Profile | null)?.full_name || (user.email ?? "")}
          role={role}
          signOutForm={
            <form action={signOutAction} className="mt-2">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#FDFBF7] transition-all hover:border-rose-400 hover:bg-rose-500 hover:text-slate-900"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          }
        />

        {/* Content — scrolls independently */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="hidden border-b-[3px] border-slate-900 bg-[#FDFBF7] md:block">
            <div className="flex items-center justify-between px-5 py-3 md:px-8">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Dashboard
                </span>
              </div>
            </div>
          </div>
          <main className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function buildNav(role: UserRole | null, staffRole?: string | null) {
  const common = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: "LayoutDashboard" as const,
    },
  ];

  // Principal gets the full admin nav.
  if (role === "principal") {
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

  // Staff members get personalized navs based on their sub-role.
  if (role === "staff") {
    const base = [...common, { href: "/dashboard/classes", label: "All Classes", icon: "Building2" as const }];
    switch (staffRole) {
      case "librarian":
        return [
          ...common,
          { href: "/dashboard/admin/library", label: "Library", icon: "Library" as const },
          { href: "/dashboard/library", label: "Catalog", icon: "Library" as const },
        ];
      case "accountant":
        return [
          ...common,
          { href: "/dashboard/admin/fees", label: "Fees", icon: "DollarSign" as const },
          { href: "/dashboard/staff", label: "Students", icon: "Users" as const },
        ];
      case "hr_clerk":
        return [
          ...common,
          { href: "/dashboard/admin/hr", label: "HR / Leave", icon: "ClipboardList" as const },
          { href: "/dashboard/staff", label: "Staff & Teachers", icon: "Users" as const },
        ];
      case "transport_manager":
        return [
          ...common,
          { href: "/dashboard/admin/transport", label: "Transport", icon: "Bus" as const },
          { href: "/dashboard/staff", label: "Students", icon: "Users" as const },
        ];
      default: // "general" or null
        return base;
    }
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
