import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { QuizTaker } from "@/components/brutal/quiz-taker";
import type { Quiz, QuizQuestion, QuizAttempt, Profile, ClassRoom } from "@/lib/types";

/**
 * Quiz taking page at /dashboard/quizzes/[quizId].
 *
 * Server component. Fetches the quiz + questions, starts (or resumes) the
 * student's attempt, then renders the QuizTaker client component.
 *
 * If the student has already submitted, we render the score view directly
 * (the QuizTaker accepts an `alreadyCompleted` prop for that).
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
  if (!profile || profile.role !== "student") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch the quiz + questions.
  const { data: quizRow, error: quizErr } = await admin
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();
  if (quizErr || !quizRow) notFound();
  const quiz = quizRow as Quiz;

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
    // Fetch the class name for the header.
    const { data: clsRow } = await admin
      .from("classes")
      .select("name")
      .eq("id", quiz.class_id)
      .single();
    const className = (clsRow as { name: string } | null)?.name ?? "Class";

    return (
      <QuizTaker
        quiz={quiz}
        questions={questions}
        attempt={existingAttempt as QuizAttempt}
        className={className}
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

  // Fetch the class name.
  const { data: clsRow } = await admin
    .from("classes")
    .select("name")
    .eq("id", quiz.class_id)
    .single();
  const className = (clsRow as { name: string } | null)?.name ?? "Class";

  return (
    <QuizTaker
      quiz={quiz}
      questions={questions}
      attempt={attempt}
      className={className}
    />
  );
}
