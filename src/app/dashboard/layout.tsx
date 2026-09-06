import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  UserCog,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrutalLogo } from "@/components/brutal/logo";
import { signOutAction } from "@/app/login/actions";
import type { Profile, UserRole } from "@/lib/types";

/**
 * DashboardLayout — the authenticated app shell.
 *
 * Server component. Fetches the current user + their profile, then renders
 * the sidebar + the page content. If there's no profile row yet (e.g. user
 * was created before the trigger), we let the page handle the empty state.
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

  // Fetch the profile; if missing, the inner page will show a "set up your
  // profile" empty state.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, principal_id")
    .eq("id", (profile as Profile | null)?.school_id ?? "")
    .single();

  const role: UserRole | null = (profile as Profile | null)?.role ?? null;

  // Build the nav based on role.
  const nav = buildNav(role);

  return (
    <div className="flex min-h-screen flex-col bg-[#FDFBF7] md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b-[3px] border-slate-900 bg-slate-900 text-[#FDFBF7] md:w-64 md:border-b-0 md:border-r-[3px]">
        <div className="px-5 py-5">
          <Link href="/" className="inline-flex">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl border-2 border-[#FDFBF7] bg-emerald-500 font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(253,251,247,0.4)]">
                C
              </div>
              <span className="text-lg font-black uppercase tracking-tight">
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

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg border-2 border-transparent px-3 py-2 text-sm font-bold uppercase tracking-wider text-slate-300 transition-all hover:border-[#FDFBF7] hover:bg-slate-800 hover:text-[#FDFBF7]"
            >
              <item.icon className="size-4" strokeWidth={2.5} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

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

      {/* Content */}
      <div className="flex-1 overflow-x-hidden">
        <div className="border-b-[3px] border-slate-900 bg-[#FDFBF7]">
          <div className="flex items-center justify-between px-5 py-4 md:px-8">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Dashboard
              </span>
            </div>
            <div className="md:hidden">
              <BrutalLogo size="sm" asLink={false} />
            </div>
          </div>
        </div>
        <div className="px-5 py-8 md:px-8 md:py-10">{children}</div>
      </div>
    </div>
  );
}

function buildNav(role: UserRole | null) {
  const common = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
  ];

  if (role === "principal" || role === "staff") {
    return [
      ...common,
      { href: "/dashboard/staff", label: "Staff & Teachers", icon: Users },
      { href: "/dashboard/classes", label: "All Classes", icon: Building2 },
      { href: "/dashboard/teacher/schedule", label: "School Schedule", icon: CalendarDays },
    ];
  }
  if (role === "teacher") {
    return [
      ...common,
      { href: "/dashboard/teacher", label: "My Classes", icon: GraduationCap },
      { href: "/dashboard/teacher/schedule", label: "My Schedule", icon: CalendarDays },
      { href: "/dashboard/students", label: "My Students", icon: UserCog },
    ];
  }
  if (role === "student") {
    return [
      ...common,
      { href: "/dashboard/classes", label: "My Class", icon: Building2 },
      { href: "/dashboard/attendance", label: "My Attendance", icon: CalendarCheck },
      { href: "/dashboard/schedule", label: "My Schedule", icon: CalendarDays },
    ];
  }
  return common;
}
