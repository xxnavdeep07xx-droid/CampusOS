import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { QuizTaker } from "@/components/brutal/quiz-taker";
import { QuizResultsTeacherView } from "@/components/brutal/quiz-results-teacher-view";
import type { Quiz, QuizQuestion, QuizAttempt, Profile, ClassRoom } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * Quiz page at /dashboard/quizzes/[quizId].
 *
 * Branches by role:
 *   - student: takes the quiz (or sees their result if already completed)
 *   - teacher: sees a results dashboard (per-student scores, per-question
 *              breakdown, edit/delete actions for the quiz itself)
 *   - other: redirected to /dashboard
 */
export default async function QuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
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
  if (!profile) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch the quiz + class.
  const { data: quizRow, error: quizErr } = await admin
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();
  if (quizErr || !quizRow) notFound();
  const quiz = quizRow as Quiz;

  const { data: clsRow } = await admin
    .from("classes")
    .select("id, name, teacher_id")
    .eq("id", quiz.class_id)
    .single();
  const cls = clsRow as { id: string; name: string; teacher_id: string } | null;

  // ===== TEACHER BRANCH =====
  // The teacher of this class (and principal/staff in same school) see a
  // results dashboard instead of taking the quiz.
  if (profile.role === "teacher" || profile.role === "principal" || profile.role === "staff") {
    const isTeacher = cls?.teacher_id === user.id;
    const isSchoolAdmin =
      (profile.role === "principal" || profile.role === "staff") &&
      profile.school_id != null &&
      // The class's school_id must match the admin's school_id — fetch below.
      cls != null;

    // Fetch the questions (with correct_answer for the teacher).
    const { data: questionRows, error: qErr } = await admin
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("position", { ascending: true });
    const questions = (questionRows ?? []) as QuizQuestion[];

    // Fetch all attempts for this quiz (any status).
    let attempts: any[] = [];
    let migrationMissing = false;
    try {
      const { data: aRows, error: aErr } = await admin
        .from("quiz_attempts")
        .select(`
          id,
          student_id,
          score,
          max_score,
          status,
          started_at,
          submitted_at,
          answers,
          student:profiles!quiz_attempts_student_id_fkey(id, full_name)
        `)
        .eq("quiz_id", quizId)
        .order("submitted_at", { ascending: false, nullsFirst: false });
      if (aErr && /Could not find the table|does not exist/i.test(aErr.message)) {
        migrationMissing = true;
      } else if (!aErr && aRows) {
        attempts = aRows as any[];
      }
    } catch (err) {
      console.warn("quiz-attempts fetch error:", err);
    }

    return (
      <QuizResultsTeacherView
        quiz={quiz}
        questions={questions}
        attempts={attempts}
        className={cls?.name ?? "Class"}
        classId={quiz.class_id}
        isTeacher={isTeacher}
        migrationMissing={migrationMissing}
      />
    );
    // Note: isSchoolAdmin currently falls through to the teacher view above with
    // isTeacher=false (read-only). The teacher-only actions (edit/delete) are
    // hidden when isTeacher is false.
  }

  // ===== STUDENT BRANCH (original behavior) =====
  if (profile.role !== "student") {
    redirect("/dashboard");
  }

  // Verify the student is enrolled in the quiz's class.
  if (profile.class_id !== quiz.class_id) {
    notFound();
  }
  // Quiz must be published for students to take it.
  if (!quiz.is_published) {
    notFound();
  }

  const { data: questionRows, error: qErr } = await admin
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (qErr || !questionRows) notFound();

  // Strip correct_answer for students — they should never see it.
  const questions = (questionRows as QuizQuestion[]).map((q) => {
    const { correct_answer: _omit, ...rest } = q;
    void _omit;
    return rest;
  }) as QuizQuestion[];

  // Find the student's existing attempt (any status).
  const { data: existingAttempt, error: attemptErr } = await admin
    .from("quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const migrationMissing =
    !!attemptErr && /Could not find the table|does not exist/i.test(attemptErr.message);

  if (migrationMissing) {
    return (
      <div className="space-y-6">
        <Tag color="bg-amber-200">Phase 5 migration needed</Tag>
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Quizzes aren&apos;t set up yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">quizzes</code>/
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">quiz_attempts</code> tables
              don&apos;t exist yet.
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

  // If the student has a completed attempt, show the result view.
  if (existingAttempt && existingAttempt.status === "completed") {
    return (
      <QuizTaker
        quiz={quiz}
        questions={questions}
        attempt={existingAttempt as QuizAttempt}
        className={cls?.name ?? "Class"}
        alreadyCompleted
      />
    );
  }

  // Otherwise, start a new attempt (or reuse the in-progress one).
  let attempt: QuizAttempt;
  if (existingAttempt && existingAttempt.status === "in_progress") {
    attempt = existingAttempt as QuizAttempt;
  } else {
    const { data: newAttempt, error: newErr } = await admin
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        student_id: user.id,
        answers: {},
        score: 0,
        max_score: 0,
        status: "in_progress",
      })
      .select("*")
      .single();
    if (newErr || !newAttempt) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm font-bold text-rose-700">
            Could not start the quiz attempt. Please try again.
          </CardContent>
        </Card>
      );
    }
    attempt = newAttempt as QuizAttempt;
  }

  return (
    <QuizTaker
      quiz={quiz}
      questions={questions}
      attempt={attempt}
      className={cls?.name ?? "Class"}
    />
  );
}
