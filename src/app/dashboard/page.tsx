import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  Megaphone,
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
import { roleColor } from "@/lib/types";

/**
 * /dashboard — role-aware dispatcher.
 *
 * Previously this page rendered the Principal's dashboard unconditionally,
 * which meant teachers landing on "Overview" saw principal-only stat cards,
 * invite generators, and recent-invites activity feed. Now we branch on the
 * signed-in user's role and render a tailored Overview page for each role.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();
  const profile = profileRow as Profile | null;

  // Branch on role. Principal/staff keep their existing rich dashboard.
  // Teachers get a Today-focused dashboard built for their workflow.
  // Students/parents fall back to principal-style for now (Phase: future).
  const role = profile?.role;
  if (role === "teacher") {
    return <TeacherDashboard profile={profile} />;
  }
  return <PrincipalDashboard profile={profile} />;
}

/* ------------------------------------------------------------------ */
/* Teacher dashboard — Today-focused                                   */
/* ------------------------------------------------------------------ */

async function TeacherDashboard({ profile }: { profile: Profile | null }) {
  const supabase = await createClient();
  const teacherId = profile?.id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  // Map English weekday → the day string used in timetables (mon/fri/etc.)
  const dayKey = { monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun" }[dayName] ?? dayName.slice(0, 3);

  // Fetch the teacher's classes + their students count (in parallel with
  // everything else to keep the page fast).
  const { data: classesRaw } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", teacherId)
    .order("name");
  const classes = (classesRaw ?? []) as { id: string; name: string }[];
  const classIds = classes.map((c) => c.id);

  // Today's periods from the timetable (recurring weekly schedule).
  // Errors are tolerated — the timetables table may not exist on fresh deploys.
  let todaySlots: { id: string; class_id: string; day: string; start_time: string; end_time: string; subject: string | null }[] = [];
  try {
    const { data: slots, error: slotsErr } = await supabase
      .from("timetables")
      .select("id, class_id, day, start_time, end_time, subject")
      .in("class_id", classIds.length > 0 ? classIds : ["__none__"])
      .eq("day", dayKey)
      .order("start_time");
    if (!slotsErr && slots) todaySlots = slots as typeof todaySlots;
  } catch (err) {
    console.warn("timetable fetch error:", err);
  }

  // Pending grading queue — count of submissions without a grade across
  // the teacher's assignments. Errors tolerated (table may be missing).
  let pendingGradingCount = 0;
  let recentUngraded: { id: string; assignment_title: string; student_name: string; class_name: string; submitted_at: string }[] = [];
  try {
    const { data: ungraded, error: ungradedErr } = await supabase
      .from("submissions")
      .select(`
        id,
        submitted_at,
        student:profiles!inner(full_name),
        assignment:assignments!inner(title, class_id, classes!inner(name))
      `)
      .is("grade", null)
      .order("submitted_at", { ascending: false })
      .limit(5);
    if (!ungradedErr && ungraded) {
      pendingGradingCount = ungraded.length;
      recentUngraded = (ungraded as any[]).map((r) => ({
        id: r.id,
        assignment_title: r.assignment?.title ?? "—",
        student_name: r.student?.full_name ?? "—",
        class_name: r.assignment?.classes?.name ?? "—",
        submitted_at: r.submitted_at,
      }));
    }
  } catch (err) {
    console.warn("submissions fetch error:", err);
  }

  // Today's attendance rate (out of the teacher's own students, not school-wide).
  let presentToday = 0;
  let totalMarkedToday = 0;
  try {
    const { data: todayRows } = await supabase
      .from("attendance")
      .select("status, classes!inner(teacher_id)")
      .eq("date", today)
      .eq("classes.teacher_id", teacherId);
    if (todayRows) {
      for (const r of todayRows as Array<{ status: string }>) {
        totalMarkedToday++;
        if (r.status === "present") presentToday++;
      }
    }
  } catch (err) {
    console.warn("attendance fetch error:", err);
  }
  const attendanceRate =
    totalMarkedToday > 0 ? Math.round((presentToday / totalMarkedToday) * 100) : null;

  // Recent announcements posted by this teacher (last 3).
  const { data: annRaw } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, pinned, class_id, classes(name)")
    .in("class_id", classIds.length > 0 ? classIds : ["__none__"])
    .order("created_at", { ascending: false })
    .limit(3);
  const recentAnnouncements = (annRaw ?? []) as any[];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="space-y-2">
        <Tag color="bg-violet-400">Teacher dashboard</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Welcome, {profile?.full_name || "Teacher"}.
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Here&apos;s your day at a glance — your classes, what needs grading,
          and what you&apos;ve announced recently.
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon="GraduationCap"
          label="My Classes"
          value={classes.length}
          sublabel="Classes you teach"
          color="bg-violet-400"
        />
        <StatCard
          icon="ClipboardList"
          label="Pending Grading"
          value={pendingGradingCount}
          sublabel={pendingGradingCount > 0 ? "Submissions awaiting grade" : "All caught up"}
          color={pendingGradingCount > 0 ? "bg-amber-300" : "bg-emerald-400"}
        />
        <StatCard
          icon="CalendarCheck"
          label="Today's Attendance"
          value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
          sublabel={totalMarkedToday > 0 ? `${presentToday}/${totalMarkedToday} present today` : "Not marked yet"}
          color={attendanceRate === null ? "bg-slate-300" : attendanceRate >= 90 ? "bg-emerald-400" : attendanceRate >= 75 ? "bg-amber-300" : "bg-rose-400"}
        />
        <StatCard
          icon="CalendarCheck"
          label="Today's Periods"
          value={todaySlots.length}
          sublabel={dayName.charAt(0).toUpperCase() + dayName.slice(1)}
          color="bg-sky-300"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-black uppercase tracking-tight">
                Today&apos;s Schedule
              </CardTitle>
              <CardDescription>
                {todaySlots.length > 0
                  ? `${todaySlots.length} period${todaySlots.length === 1 ? "" : "s"} scheduled today`
                  : "No periods scheduled today"}
              </CardDescription>
            </div>
            <Link
              href="/dashboard/teacher/schedule"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
            >
              Full week
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaySlots.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 py-6 text-center">
                <p className="text-sm font-medium text-slate-500">
                  Nothing on the calendar for today. Enjoy the breather.
                </p>
              </div>
            ) : (
              todaySlots.map((slot) => {
                const cls = classes.find((c) => c.id === slot.class_id);
                return (
                  <Link
                    key={slot.id}
                    href={`/dashboard/classes/${slot.class_id}`}
                    className="flex items-center justify-between rounded-lg border-2 border-slate-200 bg-[#FDFBF7] px-3 py-2 transition-all hover:border-slate-900 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {cls?.name ?? "Class"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {slot.subject ?? "—"}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 rounded-md border-2 border-slate-900 bg-amber-300 px-2 py-1 text-xs font-black text-slate-900">
                      {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Pending grading */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-black uppercase tracking-tight">
                Pending Grading
              </CardTitle>
              <CardDescription>
                {pendingGradingCount > 0
                  ? `${pendingGradingCount} submission${pendingGradingCount === 1 ? "" : "s"} awaiting a grade`
                  : "All caught up — no pending submissions"}
              </CardDescription>
            </div>
            {pendingGradingCount > 0 && (
              <Link
                href="/dashboard/teacher/grading"
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
              >
                Open queue
                <ArrowRight className="size-4" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUngraded.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 py-6 text-center">
                <Sparkles className="mx-auto mb-2 size-5 text-emerald-500" />
                <p className="text-sm font-medium text-slate-500">
                  No submissions waiting. Nice work.
                </p>
              </div>
            ) : (
              recentUngraded.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border-2 border-slate-200 bg-[#FDFBF7] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">
                      {s.student_name}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {s.assignment_title} · {s.class_name}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-xs font-medium text-slate-400">
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction href="/dashboard/teacher" icon="GraduationCap" label="My Classes" color="bg-violet-400" />
        <QuickAction href="/dashboard/teacher/grading" icon="ClipboardList" label="Grade Submissions" color="bg-amber-300" />
        <QuickAction href="/dashboard/teacher/schedule" icon="CalendarCheck" label="My Schedule" color="bg-sky-300" />
        <QuickAction href="/dashboard/teacher/leave" icon="Megaphone" label="Request Leave" color="bg-rose-400" />
      </div>

      {/* Recent announcements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight">
            Recent Announcements
          </h2>
          <Link
            href="/dashboard/teacher"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
          >
            My classes
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recentAnnouncements.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Megaphone className="mx-auto mb-3 size-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">
                No announcements posted yet.
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Open one of your classes to post a new announcement.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {recentAnnouncements.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Badge variant="emerald">Pinned</Badge>}
                    <span className="text-xs font-medium text-slate-500">
                      {a.classes?.name ?? "—"}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-sm font-bold text-slate-900">
                    {a.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {a.body}
                  </div>
                  <div className="mt-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border-2 border-slate-900 bg-[#FDFBF7] p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"
    >
      <div className={`flex size-9 items-center justify-center rounded-lg ${color} border-2 border-slate-900`}>
        <QuickActionIcon name={icon} />
      </div>
      <span className="text-sm font-bold uppercase tracking-tight text-slate-900">
        {label}
      </span>
    </Link>
  );
}

function QuickActionIcon({ name }: { name: string }) {
  const props = { className: "size-4 text-slate-900", strokeWidth: 2.5 } as const;
  switch (name) {
    case "GraduationCap": return <GraduationCap {...props} />;
    case "ClipboardList": return <ClipboardList {...props} />;
    case "CalendarCheck": return <CalendarCheck {...props} />;
    case "Megaphone": return <Megaphone {...props} />;
    case "Users": return <Users {...props} />;
    case "Building2": return <Building2 {...props} />;
    case "UserCog": return <UserCog {...props} />;
    default: return <GraduationCap {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/* Principal dashboard — preserved as-is                              */
/* ------------------------------------------------------------------ */

async function PrincipalDashboard({ profile }: { profile: Profile | null }) {
  const supabase = await createClient();
  const p = profile;

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

  const invites = (recentInvites ?? []) as unknown as (Invitation & {
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
          icon="Users"
          label="Total Students"
          value={studentCount ?? 0}
          sublabel="Enrolled across all classes"
          color="bg-amber-300"
        />
        <StatCard
          icon="GraduationCap"
          label="Total Teachers"
          value={teacherCount ?? 0}
          sublabel="Active teaching staff"
          color="bg-violet-400"
        />
        <StatCard
          icon="UserCog"
          label="Staff"
          value={staffCount ?? 0}
          sublabel="Non-teaching staff"
          color="bg-sky-300"
        />
        <StatCard
          icon="Building2"
          label="Classes"
          value={classCount ?? 0}
          sublabel="Across your school"
          color="bg-emerald-400"
        />
        {/* Today's Attendance Rate widget (Phase 3) */}
        <StatCard
          icon="CalendarCheck"
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
  return (
    <Card className="brutal-hover">
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`capitalize ${roleColor(role)}`}
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
