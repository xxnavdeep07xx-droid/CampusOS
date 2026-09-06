import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, GraduationCap, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tag } from "@/components/brutal/section";
import { StatusBadge } from "@/components/brutal/status-toggle";
import type { Profile, ClassRoom, GradebookRow, QuizAttempt } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/storage";
import { gradeHex } from "@/lib/types";

/**
 * My Grades page at /dashboard/grades.
 *
 * Server component. Fetches the student's gradebook rows across all their
 * classes (via the class_gradebook view) + their completed quiz attempts.
 *
 * Renders:
 *   - A grid of "Class report cards" — one per class — each with:
 *     - A circular progress ring (SVG) showing the overall percentage.
 *     - Side bars for assignment % + quiz %.
 *     - A chronological list of recent quiz attempts with scores.
 */
export default async function MyGradesPage() {
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

  // Only students have a "My Grades" page; teachers/principals redirect.
  if (profile.role !== "student") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch gradebook rows for this student across all classes.
  const { data: gradebookRows, error: gbErr } = await admin
    .from("class_gradebook")
    .select("*")
    .eq("student_id", user.id)
    .order("class_name", { ascending: true });

  const migrationMissing =
    !!gbErr && /Could not find the table|does not exist/i.test(gbErr.message);

  const rows = (gradebookRows ?? []) as unknown as GradebookRow[];

  // Fetch completed quiz attempts for this student (joined with quiz + class).
  const { data: attemptRows } = await admin
    .from("quiz_attempts")
    .select(
      "id, score, max_score, completed_at, status, quiz:quizzes(id, title, class_id, classes!inner(id, name))"
    )
    .eq("student_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20);

  const attempts = (attemptRows ?? []) as unknown as Array<{
    id: string;
    score: number;
    max_score: number;
    completed_at: string;
    status: string;
    quiz: {
      id: string;
      title: string;
      class_id: string;
      classes: { id: string; name: string } | { id: string; name: string }[];
    } | null;
  }>;

  if (migrationMissing) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Tag color="bg-amber-200">
            <BarChart3 className="size-3.5" />
            My Grades
          </Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            Your report card
          </h1>
        </div>
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 5 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">class_gradebook</code> view
              doesn&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Ask your teacher to apply{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0005_quizzes_gradebook.sql</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Tag color="bg-sky-300">
            <BarChart3 className="size-3.5" />
            My Grades
          </Tag>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
            Your report card
          </h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-sky-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Inbox className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No grades yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Once your teacher grades your assignments or you complete a quiz,
              your report card will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Aggregate summary.
  const classesWithGrades = rows.filter((r) => r.percentage != null);
  const overall =
    classesWithGrades.length > 0
      ? Math.round(
          classesWithGrades.reduce((s, r) => s + (r.percentage ?? 0), 0) /
            classesWithGrades.length
        )
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-sky-300">
          <BarChart3 className="size-3.5" />
          My Grades
        </Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Your report card
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Auto-aggregated from your graded assignments + completed quizzes across{" "}
          {rows.length} {rows.length === 1 ? "class" : "classes"}.
        </p>
      </div>

      {/* Overall summary card */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
        <CardContent className="flex flex-wrap items-center justify-between gap-6 py-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Overall across all classes
            </div>
            <div className="mt-1 text-5xl font-black tabular-nums text-slate-900">
              {overall == null ? "—" : `${overall}%`}
            </div>
          </div>
          <div className="w-full max-w-sm">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {classesWithGrades.length} / {rows.length} classes have grades
            </div>
            <Progress value={overall ?? 0} className="h-4" />
          </div>
        </CardContent>
      </Card>

      {/* Per-class report cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => {
          const pct = row.percentage;
          const color = gradeHex(pct);
          const assignmentPct =
            row.assignment_total_points > 0
              ? Math.round(
                  (row.assignment_earned_points / row.assignment_total_points) * 100
                )
              : null;
          const quizPct =
            row.quiz_total_points > 0
              ? Math.round(
                  (row.quiz_earned_points / row.quiz_total_points) * 100
                )
              : null;
          return (
            <Card key={row.class_id} className="overflow-hidden">
              <div className="h-2 w-full border-x-2 border-t-2 border-slate-900" style={{ background: color }} />
              <CardHeader>
                <CardTitle className="text-lg">{row.class_name}</CardTitle>
                <CardDescription>
                  {row.assignment_count + row.quiz_count} graded{" "}
                  {(row.assignment_count + row.quiz_count) === 1 ? "item" : "items"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Circular progress ring */}
                <div className="flex items-center gap-4">
                  <GradeRing pct={pct} color={color} />
                  <div className="flex-1 space-y-2">
                    <MiniBar label="Assignments" pct={assignmentPct} color="#10b981" />
                    <MiniBar label="Quizzes" pct={quizPct} color="#38bdf8" />
                  </div>
                </div>

                {/* Recent attempts for this class */}
                {attempts.filter((a) => a.quiz?.class_id === row.class_id).length > 0 && (
                  <div className="border-t-2 border-slate-100 pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Recent quizzes
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {attempts
                        .filter((a) => a.quiz?.class_id === row.class_id)
                        .slice(0, 3)
                        .map((a) => {
                          const aPct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                          return (
                            <div
                              key={a.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate font-bold text-slate-700">
                                {a.quiz?.title ?? "Quiz"}
                              </span>
                              <span className="font-mono font-black" style={{ color: gradeHex(aPct) }}>
                                {a.score}/{a.max_score}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                <Link
                  href={`/dashboard/classes/${row.class_id}`}
                  className="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
                >
                  Open class
                  <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Circular progress ring (SVG)
// ============================================================
function GradeRing({
  pct,
  color,
}: {
  pct: number | null;
  color: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const value = pct ?? 0;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative size-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-black text-slate-900">
          {pct == null ? "—" : `${pct}%`}
        </span>
        {pct != null && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F"}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Mini horizontal bar (for assignment % / quiz %)
// ============================================================
function MiniBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number | null;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span>{label}</span>
        <span>{pct == null ? "—" : `${pct}%`}</span>
      </div>
      <div className="mt-0.5 h-2.5 w-full overflow-hidden rounded-full border border-slate-900 bg-[#FDFBF7]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct ?? 0}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
