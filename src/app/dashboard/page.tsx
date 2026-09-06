import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  GraduationCap,
  QrCode,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import { StatCard } from "@/components/brutal/stat-card";
import { InviteCard } from "@/components/brutal/invite-card";
import type { Profile, School, Invitation, UserRole } from "@/lib/types";

export default async function PrincipalDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the principal's profile + school.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const p = profile as Profile | null;

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("*")
    .eq("id", p?.school_id ?? "")
    .single();

  const school = schoolRow as School | null;

  // Fetch aggregate counts for the dashboard header.
  const [{ count: teacherCount }, { count: staffCount }, { count: classCount }, { count: studentCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("school_id", p?.school_id ?? "")
        .eq("role", "teacher"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("school_id", p?.school_id ?? "")
        .eq("role", "staff"),
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("school_id", p?.school_id ?? ""),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("school_id", p?.school_id ?? "")
        .eq("role", "student"),
    ]);

  // ===== Today's attendance rate (Phase 3 analytics widget) =====
  // Fetch all attendance rows for today across all classes in the school.
  // Errors are tolerated (e.g. Phase 3 migration not applied yet).
  const today = new Date().toISOString().slice(0, 10);
  let attendanceRate: number | null = null;
  let presentToday = 0;
  let totalMarkedToday = 0;
  let attendanceMigrationMissing = false;
  try {
    // We can't filter by school_id directly (attendance table doesn't
    // have it), so we fetch today's attendance joined with the class's
    // school_id and filter client-side.
    const { data: todayRows, error: todayErr } = await supabase
      .from("attendance")
      .select("status, classes!inner(school_id)")
      .eq("date", today)
      .eq("classes.school_id", p?.school_id ?? "");

    if (todayErr && /Could not find the table/i.test(todayErr.message)) {
      attendanceMigrationMissing = true;
    } else if (!todayErr && todayRows) {
      for (const r of todayRows as Array<{ status: string }>) {
        totalMarkedToday++;
        if (r.status === "present") presentToday++;
      }
      attendanceRate =
        totalMarkedToday > 0
          ? Math.round((presentToday / totalMarkedToday) * 100)
          : null;
    }
  } catch (err) {
    console.warn("attendance analytics error:", err);
  }

  // Recent invitations for the activity feed.
  const { data: recentInvites } = await supabase
    .from("invitations")
    .select("id, role, token, is_used, created_at, class_id, classes(name)")
    .eq("school_id", p?.school_id ?? "")
    .order("created_at", { ascending: false })
    .limit(6);

  const invites = (recentInvites ?? []) as (Invitation & {
    classes?: { name: string } | null;
  })[];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="space-y-2">
        <Tag color="bg-emerald-300">Principal dashboard</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Welcome, {p?.full_name || "Principal"}.
        </h1>
        <p className="text-sm font-medium text-slate-600">
          You manage <span className="font-bold text-slate-900">{school?.name ?? "your school"}</span>.
          Generate staff &amp; teacher invites below — each invite produces a
          shareable link and a QR code.
        </p>
      </div>

      {/* Stat grid — vibrant chunky cards, one per Phase 3 spec color */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={Users}
          label="Total Students"
          value={studentCount ?? 0}
          sublabel="Enrolled across all classes"
          color="bg-amber-300"
        />
        <StatCard
          icon={GraduationCap}
          label="Total Teachers"
          value={teacherCount ?? 0}
          sublabel="Active teaching staff"
          color="bg-violet-400"
        />
        <StatCard
          icon={UserCog}
          label="Staff"
          value={staffCount ?? 0}
          sublabel="Non-teaching staff"
          color="bg-sky-300"
        />
        <StatCard
          icon={Building2}
          label="Classes"
          value={classCount ?? 0}
          sublabel="Across your school"
          color="bg-emerald-400"
        />
        {/* Today's Attendance Rate widget (Phase 3) */}
        <StatCard
          icon={CalendarCheck}
          label="Today's Attendance"
          value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
          sublabel={
            attendanceMigrationMissing
              ? "Phase 3 migration needed"
              : attendanceRate !== null
              ? `${presentToday}/${totalMarkedToday} present today`
              : "No attendance marked today"
          }
          color={
            attendanceRate === null
              ? "bg-slate-300"
              : attendanceRate >= 90
              ? "bg-emerald-400"
              : attendanceRate >= 75
              ? "bg-amber-300"
              : "bg-rose-400"
          }
        />
      </div>

      {/* Invite generation grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <InviteCard
          role="staff"
          title="Generate a Staff invite"
          description="Staff members can manage operations across your school — they cannot teach classes."
          accentColor="bg-sky-300"
          ctaLabel="Generate staff invite"
        />
        <InviteCard
          role="teacher"
          title="Generate a Teacher invite"
          description="Teachers can create classes and invite students. Share this link with a teacher you want to onboard."
          accentColor="bg-violet-400"
          ctaLabel="Generate teacher invite"
        />
      </div>

      {/* Recent activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight">
            Recent invites
          </h2>
          <Link
            href="/dashboard/staff"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
          >
            See all
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {invites.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <Sparkles className="size-6 text-slate-900" />
              </div>
              <p className="text-sm font-bold text-slate-900">
                No invites yet — generate your first one above.
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Every invite produces a one-use link + a scannable QR code.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {invites.map((inv) => (
              <InviteListItem
                key={inv.id}
                role={inv.role as UserRole}
                token={inv.token}
                className={inv.classes?.name ?? null}
                isUsed={inv.is_used}
                createdAt={inv.created_at}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteListItem({
  role,
  token,
  className,
  isUsed,
  createdAt,
}: {
  role: UserRole;
  token: string;
  className: string | null;
  isUsed: boolean;
  createdAt: string;
}) {
  const roleColor: Record<UserRole, string> = {
    principal: "bg-slate-900 text-[#FDFBF7]",
    staff: "bg-sky-300 text-slate-900",
    teacher: "bg-violet-300 text-slate-900",
    student: "bg-rose-300 text-slate-900",
  };

  return (
    <Card className="brutal-hover">
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`capitalize ${roleColor[role]}`}
            >
              {role}
            </Badge>
            {isUsed ? (
              <Badge variant="destructive">Used</Badge>
            ) : (
              <Badge variant="emerald">Active</Badge>
            )}
          </div>
          <div className="mt-2 truncate font-mono text-xs text-slate-500">
            {token.slice(0, 8)}…{token.slice(-4)}
          </div>
          {className && (
            <div className="mt-1 text-xs font-medium text-slate-600">
              Class: <span className="font-bold text-slate-900">{className}</span>
            </div>
          )}
          <div className="mt-1 text-xs text-slate-500">
            {new Date(createdAt).toLocaleString()}
          </div>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg border-2 border-slate-900 bg-[#FDFBF7]">
          <QrCode className="size-5 text-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}
