import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { AttendanceTaker } from "@/components/brutal/attendance-taker";
import type { ClassRoom, Profile, AttendanceStatus } from "@/lib/types";
import { toDateInputValue } from "@/lib/types";

/**
 * Attendance taker page at:
 *   /dashboard/classes/[classId]/attendance
 *
 * Server component. Fetches the class + enrolled students + today's
 * existing attendance rows (so the client component can pre-populate).
 */
export default async function AttendancePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + class in parallel.
  const [{ data: profileRow }, { data: classRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  if (!cls) notFound();
  if (!profile || profile.school_id !== cls.school_id) notFound();

  // Authorization: caller must be the teacher of this class.
  if (cls.teacher_id !== user.id) {
    redirect(`/dashboard/classes/${classId}`);
  }

  // Fetch enrolled students + today's existing attendance in parallel.
  const today = toDateInputValue(new Date());
  const [
    { data: studentRows },
    { data: attendanceRows, error: attendanceErr },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("class_id", classId)
      .eq("role", "student")
      .order("full_name", { ascending: true }),
    supabase
      .from("attendance")
      .select("id, student_id, status")
      .eq("class_id", classId)
      .eq("date", today),
  ]);

  const students = (studentRows ?? []) as Pick<
    Profile,
    "id" | "full_name" | "created_at"
  >[];
  const initialRecords = (attendanceRows ?? []) as Array<{
    id: string;
    student_id: string;
    status: AttendanceStatus;
  }>;

  const migrationMissing =
    !!attendanceErr && /Could not find the table/i.test(attendanceErr.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to {cls.name}
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-emerald-300">
            <CalendarCheck className="size-3.5" />
            Attendance
          </Tag>
          <Tag color="bg-sky-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Take attendance
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Mark each student Present / Absent / Late for today, then press{" "}
          <span className="font-bold text-slate-900">Save attendance</span>.
          You can navigate to past dates to amend records.
        </p>
      </div>

      {migrationMissing ? (
        <div className="overflow-hidden rounded-xl border-2 border-amber-500 bg-amber-50 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <div className="space-y-2 p-4">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 3 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">attendance</code> table
              doesn&apos;t exist in your Supabase project yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0003_attendance_timetable.sql</code>
              {" "}via the Supabase SQL editor. See{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/README.md</code>.
            </p>
          </div>
        </div>
      ) : (
        <AttendanceTaker
          classId={classId}
          className={cls.name}
          students={students}
          initialDate={today}
          initialRecords={initialRecords}
        />
      )}
    </div>
  );
}
