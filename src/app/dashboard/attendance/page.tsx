import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/brutal/section";
import { StatCard } from "@/components/brutal/stat-card";
import { StatusBadge } from "@/components/brutal/status-toggle";
import type { Attendance, AttendanceStatus, Profile, ClassRoom } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * Student attendance history page at /dashboard/attendance.
 *
 * Server component. Fetches the student's attendance records (all of them,
 * or limited to the most recent N) + their class info.
 *
 * Renders:
 *   - Summary stats card (attendance %, days absent, days late, total).
 *   - Chronological list of attendance records with status badges.
 */
export default async function StudentAttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");
  if (profile.role !== "student") {
    // Teachers + principals get bounced to the dashboard.
    redirect("/dashboard");
  }

  // Fetch the student's attendance records + their class.
  const { data: records, error: recordsErr } = await supabase
    .from("attendance")
    .select("*, classes(id, name)")
    .eq("student_id", user.id)
    .order("date", { ascending: false })
    .limit(200);
  const attendance = (records ?? []) as Array<
    Attendance & { classes?: { id: string; name: string } | null }
  >;

  const migrationMissing =
    !!recordsErr && /Could not find the table/i.test(recordsErr.message);

  // Compute summary stats.
  let present = 0, absent = 0, late = 0;
  for (const r of attendance) {
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
    else if (r.status === "late") late++;
  }
  const total = attendance.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-emerald-300">
          <CalendarCheck className="size-3.5" />
          My attendance
        </Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Attendance history
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {total} {total === 1 ? "record" : "records"} across{" "}
          {attendance.length > 0
            ? attendance.filter(
                (r, i, arr) =>
                  arr.findIndex((x) => x.classes?.id === r.classes?.id) === i
              ).length
            : 0}{" "}
          {attendance.length === 1 ? "class" : "classes"}.
        </p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 3 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">attendance</code> table
              doesn&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Ask your teacher / principal to apply{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0003_attendance_timetable.sql</code>.
            </p>
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-emerald-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Inbox className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No attendance records yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Your teacher hasn&apos;t marked any attendance for you yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={CalendarCheck}
              label="Attendance rate"
              value={`${rate}%`}
              sublabel={`${present}/${total} days present`}
              color={
                rate >= 90
                  ? "bg-emerald-300"
                  : rate >= 75
                  ? "bg-amber-300"
                  : "bg-rose-300"
              }
            />
            <StatCard
              icon={CalendarCheck}
              label="Days present"
              value={present}
              sublabel="Full marks"
              color="bg-emerald-300"
            />
            <StatCard
              icon={CalendarCheck}
              label="Days late"
              value={late}
              sublabel="Arrived after start"
              color="bg-amber-300"
            />
            <StatCard
              icon={CalendarCheck}
              label="Days absent"
              value={absent}
              sublabel="Missed class"
              color="bg-rose-300"
            />
          </div>

          {/* History list */}
          <Card className="overflow-hidden">
            <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
            <CardHeader>
              <CardTitle>Recent records</CardTitle>
              <CardDescription>
                Showing your last {attendance.length} attendance{" "}
                {attendance.length === 1 ? "record" : "records"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y-2 divide-slate-200">
              {attendance.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {formatDate(r.date)}
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      {r.classes?.name ?? "Class"}
                    </div>
                  </div>
                  <StatusBadge status={r.status as AttendanceStatus} />
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-center text-xs font-medium text-slate-500">
            Want to see your weekly timetable?{" "}
            <Link
              href="/dashboard/schedule"
              className="font-bold text-emerald-700 underline-offset-4 hover:underline"
            >
              View schedule
              <ArrowRight className="inline size-3" />
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
