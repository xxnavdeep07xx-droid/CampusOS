import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { ReportCardsTable } from "@/components/brutal/report-cards-table";
import type { ClassRoom, Profile, AttendanceStatus, GradebookRow } from "@/lib/types";

/**
 * Report Cards page at /dashboard/classes/[classId]/report-cards.
 *
 * Server component. Fetches all enrolled students + their attendance + their
 * class_gradebook row, then renders the ReportCardsTable client component
 * with a "Generate PDF" button per student.
 *
 * Auth: caller must be the teacher of this class or a principal/staff.
 */
export default async function ReportCardsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow }, { data: classRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  if (!cls) notFound();
  if (!profile || profile.school_id !== cls.school_id) notFound();

  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin = profile.role === "principal" || profile.role === "staff";
  if (!isTeacher && !isSchoolAdmin) {
    redirect(`/dashboard/classes/${classId}`);
  }

  const admin = createAdminClient();

  // Fetch enrolled students.
  const { data: studentRows } = await admin.from("profiles")
    .select("id, full_name")
    .eq("class_id", classId)
    .eq("role", "student")
    .order("full_name", { ascending: true });
  const students = (studentRows ?? []) as Array<Pick<Profile, "id" | "full_name">>;

  // Fetch attendance per student (count present to compute rate).
  const studentIds = students.map((s) => s.id);
  let attendanceByStudent: Record<string, number | null> = {};
  if (studentIds.length > 0) {
    const { data: attRows } = await admin.from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds);
    const counts: Record<string, { present: number; total: number }> = {};
    for (const r of (attRows ?? []) as Array<{ student_id: string; status: AttendanceStatus }>) {
      if (!counts[r.student_id]) counts[r.student_id] = { present: 0, total: 0 };
      counts[r.student_id].total++;
      if (r.status === "present") counts[r.student_id].present++;
    }
    for (const s of students) {
      const c = counts[s.id];
      attendanceByStudent[s.id] = c ? Math.round((c.present / c.total) * 100) : null;
    }
  }

  // Fetch gradebook rows for these students.
  let gradebookByStudent: Record<string, Pick<GradebookRow, "percentage"> | null> = {};
  if (studentIds.length > 0) {
    const { data: gbRows } = await admin.from("class_gradebook")
      .select("student_id, percentage")
      .eq("class_id", classId);
    for (const r of (gbRows ?? []) as Array<{ student_id: string; percentage: number | null }>) {
      gradebookByStudent[r.student_id] = { percentage: r.percentage };
    }
  }

  // Merge attendance into the students array.
  const studentsWithAttendance = students.map((s) => ({
    ...s,
    attendanceRate: attendanceByStudent[s.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/classes/${classId}`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to {cls.name}
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-violet-300"><FileText className="size-3.5" /> Report Cards</Tag>
          <Tag color="bg-emerald-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">Generate Report Cards</h1>
        <p className="text-sm font-medium text-slate-600">
          Download a neo-brutalist PDF report card for each student. Includes
          attendance %, assignment + quiz grades, and overall percentage.
        </p>
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm font-bold text-slate-900">No students enrolled yet</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Generate student invites to create report cards.</p>
        </CardContent></Card>
      ) : (
        <ReportCardsTable students={studentsWithAttendance} gradebookByStudent={gradebookByStudent} />
      )}
    </div>
  );
}
