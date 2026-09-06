import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/types";
import { gradeAttempt } from "@/lib/types";

/**
 * PATCH /api/quiz-attempts/[id]
 *
 * Body: { answers?: Record<string, string>, submit?: boolean }
 *
 * - Updates the attempt's `answers` (always allowed while in_progress).
 * - If `submit` is true, sets status='completed' + computes score +
 *   max_score server-side (the client never sends a score — it must be
 *   computed from the quiz's correct_answer fields).
 *
 * Auth: caller must be the student who owns the attempt.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: { answers?: Record<string, string>; submit?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the attempt + verify ownership.
  const { data: attempt, error: attemptErr } = await admin
    .from("quiz_attempts")
    .select("id, quiz_id, student_id, status, answers, started_at")
    .eq("id", id)
    .single();
  if (attemptErr || !attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }
  if (attempt.student_id !== user.id) {
    return NextResponse.json(
      { error: "You can only submit your own quiz attempt." },
      { status: 403 }
    );
  }
  if (attempt.status === "completed") {
    return NextResponse.json(
      { error: "This attempt has already been submitted." },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (body.answers !== undefined) {
    update.answers = body.answers;
  }

  // If submitting, compute the score server-side.
  if (body.submit === true) {
    // Fetch the quiz's questions + their correct answers.
    const { data: questionRows, error: qErr } = await admin
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", attempt.quiz_id)
      .order("position", { ascending: true });
    if (qErr) {
      return NextResponse.json(
        { error: "Could not load questions for grading: " + qErr.message },
        { status: 500 }
      );
    }
    const questions = (questionRows ?? []) as unknown as QuizQuestion[];
    const finalAnswers = (body.answers ?? (attempt.answers as Record<string, string>)) as Record<string, string>;
    const { score, maxScore } = gradeAttempt(questions, finalAnswers);
    update.score = score;
    update.max_score = maxScore;
    update.status = "completed";
    update.completed_at = new Date().toISOString();
  }

  const { data: updated, error: updateErr } = await admin
    .from("quiz_attempts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update attempt." },
      { status: 500 }
    );
  }

  return NextResponse.json({ attempt: updated });
}
