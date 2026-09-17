import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  ClipboardList,
  Edit3,
  Megaphone,
  Phone,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import { StudentBehaviorLog } from "./student-behavior-log";
import { StudentParentContactEditor } from "./student-parent-contact-editor";
import type { Profile, ClassRoom, BehaviorIncident } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * /dashboard/students/[studentId]
 *
 * Student 360° Profile — aggregates attendance, grades, behavior log,
 * and parent contact info on a single page.
 *
 * Authorization: caller must be the teacher of the student's class, or a
 * school admin. Anyone else is redirected.
 *
 * All the heavy data (attendance rows, gradebook view, behavior incidents)
 * is fetched server-side; the behavior log + parent contact editor are
 * interactive client components that operate on the same data.
 */
export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: callerProfileRow }, { data: studentRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("profiles").select("*").eq("id", studentId).single(),
  ]);
  const caller = callerProfileRow as Profile | null;
  const student = studentRow as Profile | null;
  if (!student || student.role !== "student") notFound();

  // Fetch the student's class to check teacher authorization.
  let cls: { id: string; name: string; teacher_id: string } | null = null;
  if (student.class_id) {
    const { data: clsRow } = await supabase
      .from("classes")
      .select("id, name, teacher_id")
      .eq("id", student.class_id)
      .single();
    cls = clsRow as { id: string; name: string; teacher_id: string } | null;
  }

  const isTeacher = cls?.teacher_id === user.id;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id === student.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return (
      <div className="space-y-4">
        <Tag color="bg-rose-400">Access restricted</Tag>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-bold text-slate-900">
              You can only view profiles of students in your own class.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const admin = createAdminClient();

  // ===== Attendance history (last 30 rows, most recent first) =====
  let attendanceRows: { id: string; date: string; status: string }[] = [];
  let attendanceRate: number | null = null;
  try {
    const { data: aRows, error: aErr } = await admin
      .from("attendance")
      .select("id, date, status")
      .eq("student_id", studentId)
      .order("date", { ascending: false })
      .limit(30);
    if (!aErr && aRows) attendanceRows = aRows as typeof attendanceRows;
    if (attendanceRows.length > 0) {
      const present = attendanceRows.filter((r) => r.status === "present").length;
      attendanceRate = Math.round((present / attendanceRows.length) * 100);
    }
  } catch (err) {
    console.warn("attendance fetch error:", err);
  }

  // ===== Grades — pull from class_gradebook view =====
  type GradebookRow = {
    percentage: number | null;
    assignment_earned_points: number | null;
    assignment_total_points: number | null;
    quiz_earned_points: number | null;
    quiz_total_points: number | null;
  };
  let gradebookRow: GradebookRow | null = null;
  try {
    const { data: gRow, error: gErr } = await admin
      .from("class_gradebook")
      .select("percentage, assignment_earned_points, assignment_total_points, quiz_earned_points, quiz_total_points")
      .eq("student_id", studentId)
      .maybeSingle();
    if (!gErr && gRow) gradebookRow = gRow as unknown as GradebookRow;
  } catch (err) {
    console.warn("gradebook fetch error:", err);
  }

  // ===== Recent assignment submissions =====
  let recentSubmissions: { id: string; submitted_at: string; grade: number | null; assignment_id: string; assignment_title?: string }[] = [];
  try {
    const { data: sRows } = await admin
      .from("submissions")
      .select(`
        id,
        submitted_at,
        grade,
        assignment_id,
        assignment:assignments!inner(title)
      `)
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false })
      .limit(5);
    if (sRows) {
      recentSubmissions = (sRows as any[]).map((r) => ({
        id: r.id,
        submitted_at: r.submitted_at,
        grade: r.grade,
        assignment_id: r.assignment_id,
        assignment_title: r.assignment?.title ?? "—",
      }));
    }
  } catch (err) {
    console.warn("submissions fetch error:", err);
  }

  // ===== Behavior incidents =====
  let incidents: BehaviorIncident[] = [];
  try {
    const { data: iRows, error: iErr } = await admin
      .from("behavior_incidents")
      .select("*")
      .eq("student_id", studentId)
      .order("incident_date", { ascending: false })
      .limit(50);
    if (!iErr && iRows) incidents = iRows as BehaviorIncident[];
  } catch (err) {
    console.warn("incidents fetch error:", err);
  }

  const gradeLetter = gradebookRow?.percentage == null ? null
    : gradebookRow.percentage >= 90 ? "A"
    : gradebookRow.percentage >= 80 ? "B"
    : gradebookRow.percentage >= 70 ? "C"
    : gradebookRow.percentage >= 60 ? "D"
    : "F";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to my students
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-rose-300">Student profile</Tag>
          {cls && <Tag color="bg-sky-300">{cls.name}</Tag>}
          {gradebookRow?.percentage != null && gradebookRow.percentage < 60 && (
            <Badge variant="destructive">At risk</Badge>
          )}
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {student.full_name || "(no name)"}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Joined {formatDate(student.created_at)}
          {cls && <> · {cls.name}</>}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<CalendarCheck className="size-4" />}
          label="Attendance"
          value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
          sublabel={attendanceRows.length > 0 ? `${attendanceRows.length} records` : "No records"}
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
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Overall grade"
          value={gradebookRow?.percentage != null ? `${gradebookRow.percentage}%` : "—"}
          sublabel={gradeLetter ? `Grade ${gradeLetter}` : "No grades yet"}
          color={
            gradebookRow?.percentage == null
              ? "bg-slate-300"
              : gradebookRow.percentage >= 70
              ? "bg-emerald-400"
              : gradebookRow.percentage >= 50
              ? "bg-amber-300"
              : "bg-rose-400"
          }
        />
        <StatCard
          icon={<ClipboardList className="size-4" />}
          label="Recent submissions"
          value={recentSubmissions.length}
          sublabel="Last 5"
          color="bg-sky-300"
        />
        <StatCard
          icon={<Megaphone className="size-4" />}
          label="Behavior logs"
          value={incidents.length}
          sublabel={
            incidents.length === 0
              ? "None logged"
              : `${incidents.filter((i) => i.severity === "positive").length} positive · ${incidents.filter((i) => i.severity === "concern").length} concern`
          }
          color="bg-violet-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Parent contact + behavioral notes editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
              <Phone className="size-4" /> Parent / guardian contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StudentParentContactEditor
              studentId={student.id}
              initialParentContact={student.parent_contact ?? ""}
              initialParentPhone={student.parent_phone ?? ""}
              initialBehavioralNotes={student.behavioral_notes ?? ""}
            />
          </CardContent>
        </Card>

        {/* Attendance history with heatmap */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                <CalendarCheck className="size-4" /> Attendance
              </CardTitle>
              {attendanceRate !== null && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
                    <div
                      className={`h-full transition-all ${
                        attendanceRate >= 90 ? "bg-emerald-500"
                        : attendanceRate >= 75 ? "bg-amber-400"
                        : "bg-rose-500"
                      }`}
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                  <span className={`text-xs font-black ${
                    attendanceRate >= 90 ? "text-emerald-700"
                    : attendanceRate >= 75 ? "text-amber-700"
                    : "text-rose-700"
                  }`}>
                    {attendanceRate}%
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {attendanceRows.length === 0 ? (
              <p className="py-4 text-center text-sm font-medium text-slate-500">
                No attendance records yet.
              </p>
            ) : (
              <>
                {/* Heatmap — last 30 records as colored cells */}
                <div className="mb-4">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Last {Math.min(30, attendanceRows.length)} records
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {attendanceRows.slice(0, 30).map((r) => (
                      <div
                        key={r.id}
                        className={`flex size-5 items-center justify-center rounded border border-slate-300 text-[8px] font-black ${
                          r.status === "present"
                            ? "bg-emerald-400 text-emerald-950"
                            : r.status === "absent"
                            ? "bg-rose-400 text-rose-950"
                            : "bg-amber-300 text-amber-950"
                        }`}
                        title={`${formatDate(r.date)} — ${r.status}`}
                      >
                        {r.status === "present" ? "P" : r.status === "absent" ? "A" : "L"}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="size-3 rounded bg-emerald-400" /> Present
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-3 rounded bg-amber-300" /> Late
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-3 rounded bg-rose-400" /> Absent
                    </span>
                  </div>
                </div>

                {/* Recent records list */}
                <div className="border-t-2 border-slate-100 pt-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Recent records
                  </div>
                  <ul className="space-y-1">
                    {attendanceRows.slice(0, 8).map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded-lg border-2 border-slate-200 bg-[#FDFBF7] px-3 py-2 text-xs">
                        <span className="font-bold text-slate-700">{formatDate(r.date)}</span>
                        <Badge
                          variant={
                            r.status === "present"
                              ? "emerald"
                              : r.status === "absent"
                              ? "destructive"
                              : "amber"
                          }
                        >
                          {r.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
            <ClipboardList className="size-4" /> Recent submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSubmissions.length === 0 ? (
            <p className="py-4 text-center text-sm font-medium text-slate-500">
              No submissions yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentSubmissions.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg border-2 border-slate-200 bg-[#FDFBF7] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">
                      {s.assignment_title}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Submitted {formatDate(s.submitted_at)}
                    </div>
                  </div>
                  <Badge variant={s.grade == null ? "outline" : s.grade >= 70 ? "emerald" : s.grade >= 50 ? "amber" : "destructive"}>
                    {s.grade == null ? "Pending grade" : `${s.grade}/100`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Behavior log */}
      <StudentBehaviorLog
        studentId={student.id}
        className={cls?.name ?? "Class"}
        classId={cls?.id ?? null}
        initialIncidents={incidents}
        canEdit={isTeacher || isSchoolAdmin}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className={`flex h-1.5 items-center justify-center border-x-2 border-t-2 border-slate-900 ${color}`} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-xl font-black text-slate-900">{value}</div>
        {sublabel && <div className="text-[10px] font-medium text-slate-500">{sublabel}</div>}
      </div>
    </div>
  );
}
