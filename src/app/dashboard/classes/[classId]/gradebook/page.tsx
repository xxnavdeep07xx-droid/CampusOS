import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tag } from "@/components/brutal/section";
import { Card, CardContent } from "@/components/ui/card";
import { GradebookTable } from "@/components/brutal/gradebook-table";
import type { ClassRoom, Profile, GradebookRow } from "@/lib/types";

/**
 * Gradebook page at /dashboard/classes/[classId]/gradebook.
 *
 * Server component. Fetches the class_gradebook view rows for this class
 * (via the admin client — the view joins profiles so it requires school
 * membership, but we re-check authorization here for defense in depth).
 */
export default async function GradebookPage({
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

  // Fetch the gradebook view rows for this class. The view joins profiles
  // (only students enrolled in the class) so it requires the caller to be
  // a school member — we use the admin client to bypass RLS so the teacher
  // can see all students regardless of any edge case in the view's policy.
  const admin = createAdminClient();
  const { data: gradebookRows, error } = await admin
    .from("class_gradebook")
    .select("*")
    .eq("class_id", classId)
    .order("student_name", { ascending: true });

  const rows = (gradebookRows ?? []) as unknown as GradebookRow[];
  const migrationMissing =
    !!error && /Could not find the table|does not exist/i.test(error.message);

  // Aggregate stats for the header cards.
  const totalStudents = rows.length;
  const studentsWithGrades = rows.filter((r) => r.percentage != null).length;
  const classAverage =
    studentsWithGrades > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + (r.percentage ?? 0), 0) /
            studentsWithGrades
        )
      : null;

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
          <Tag color="bg-violet-300">
            <BarChart3 className="size-3.5" />
            Gradebook
          </Tag>
          <Tag color="bg-emerald-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Class gradebook
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Auto-aggregated from graded assignments (Phase 2) + completed quiz
          attempts. Use Export to CSV to download a spreadsheet for your
          records.
        </p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 5 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">class_gradebook</code> view
              (and the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">quizzes</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">quiz_questions</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">quiz_attempts</code> tables)
              don&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0005_quizzes_gradebook.sql</code>
              {" "}via the Supabase SQL editor. See{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/README.md</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <SummaryCard
              label="Total students"
              value={totalStudents}
              color="bg-amber-300"
            />
            <SummaryCard
              label="With grades"
              value={studentsWithGrades}
              color="bg-sky-300"
            />
            <SummaryCard
              label="Class average"
              value={classAverage == null ? "—" : `${classAverage}%`}
              color={
                classAverage == null
                  ? "bg-slate-300"
                  : classAverage >= 90
                  ? "bg-emerald-400"
                  : classAverage >= 75
                  ? "bg-amber-300"
                  : "bg-rose-400"
              }
            />
          </div>

          {/* The gradebook table */}
          <GradebookTable rows={rows} className={cls.name} />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border-[3px] border-slate-900 ${color} px-4 py-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]`}
    >
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-900/80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}
