import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestion, QuestionType } from "@/lib/types";

/**
 * POST /api/quiz-questions
 *
 * Body: { quizId, questionText, questionType, options?, correctAnswer, points? }
 *
 * Adds a single question to an existing quiz. Used by the quiz question editor
 * when the teacher adds new questions to an already-created quiz.
 *
 * Auth: caller must be the teacher of the quiz's class.
 */
export async function POST(request: Request) {
  let body: {
    quizId?: string;
    questionText?: string;
    questionType?: string;
    options?: string[];
    correctAnswer?: string;
    points?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const quizId = body.quizId?.trim();
  const questionText = body.questionText?.trim();
  const questionType = body.questionType as QuestionType | undefined;
  const correctAnswer = body.correctAnswer?.trim();
  const points = body.points ?? 1;

  if (!quizId || !questionText || !questionType || !correctAnswer) {
    return NextResponse.json(
      { error: "quizId, questionText, questionType, and correctAnswer are required." },
      { status: 400 }
    );
  }
  if (!["mcq", "short_answer"].includes(questionType)) {
    return NextResponse.json(
      { error: "questionType must be 'mcq' or 'short_answer'." },
      { status: 400 }
    );
  }
  if (questionType === "mcq") {
    const opts = body.options?.filter((o) => o.trim() !== "") ?? [];
    if (opts.length < 2) {
      return NextResponse.json(
        { error: "MCQ questions need at least 2 non-empty options." },
        { status: 400 }
      );
    }
    if (!opts.includes(correctAnswer)) {
      return NextResponse.json(
        { error: "correctAnswer must be one of the options for MCQ." },
        { status: 400 }
      );
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify the caller is the teacher of the quiz's class.
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", quizId)
    .single();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }
  const cls = (
    Array.isArray((quiz as any).classes) ? (quiz as any).classes[0] : (quiz as any).classes
  ) as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can add questions." },
      { status: 403 }
    );
  }

  // Determine the position (append after existing questions).
  const { data: maxRow } = await admin
    .from("quiz_questions")
    .select("position")
    .eq("quiz_id", quizId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((maxRow as { position: number } | null)?.position ?? -1) + 1;

  const insertRow: Record<string, unknown> = {
    quiz_id: quizId,
    question_text: questionText,
    question_type: questionType,
    correct_answer: correctAnswer,
    points,
    position: nextPosition,
  };
  if (questionType === "mcq") {
    insertRow.options = body.options!.filter((o) => o.trim() !== "");
  } else {
    insertRow.options = null;
  }

  const { data: row, error: insErr } = await admin
    .from("quiz_questions")
    .insert(insertRow)
    .select("*")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ question: row as QuizQuestion });
}
