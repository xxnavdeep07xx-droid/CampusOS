import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestion, QuestionType } from "@/lib/types";

/**
 * PATCH /api/quiz-questions/[id]
 *
 * Body: { questionText?, questionType?, options?, correctAnswer?, points? }
 *
 * Updates a single quiz question. Auth: caller must be the teacher of the
 * quiz's class.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: {
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

  const patch: Record<string, unknown> = {};
  if (body.questionText !== undefined) {
    const t = body.questionText.trim();
    if (t.length < 2) {
      return NextResponse.json(
        { error: "Question text must be at least 2 characters." },
        { status: 400 }
      );
    }
    patch.question_text = t;
  }
  if (body.questionType !== undefined) {
    if (!["mcq", "short_answer"].includes(body.questionType)) {
      return NextResponse.json(
        { error: "questionType must be 'mcq' or 'short_answer'." },
        { status: 400 }
      );
    }
    patch.question_type = body.questionType;
    // If switching to short_answer, clear options
    if (body.questionType === "short_answer") {
      patch.options = null;
    }
  }
  if (body.options !== undefined) {
    const opts = body.options.filter((o) => o.trim() !== "");
    if (opts.length < 2 && (body.questionType === "mcq" || (body.questionType === undefined && opts.length > 0))) {
      return NextResponse.json(
        { error: "MCQ questions need at least 2 non-empty options." },
        { status: 400 }
      );
    }
    patch.options = opts.length > 0 ? opts : null;
  }
  if (body.correctAnswer !== undefined) {
    patch.correct_answer = body.correctAnswer.trim();
  }
  if (body.points !== undefined) {
    const p = Number(body.points);
    if (!Number.isFinite(p) || p < 1 || p > 100) {
      return NextResponse.json(
        { error: "Points must be between 1 and 100." },
        { status: 400 }
      );
    }
    patch.points = p;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify ownership via quiz → class → teacher_id.
  const { data: question } = await admin
    .from("quiz_questions")
    .select("id, quiz_id, quizzes!inner(class_id, classes!inner(teacher_id))")
    .eq("id", id)
    .single();
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const quiz = (question as any).quizzes;
  const cls = quiz ? (Array.isArray(quiz.classes) ? quiz.classes[0] : quiz.classes) : null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can edit questions." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("quiz_questions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update question." },
      { status: 500 }
    );
  }

  return NextResponse.json({ question: updated as QuizQuestion });
}

/**
 * DELETE /api/quiz-questions/[id]
 *
 * Removes a single question from a quiz. Auth: caller must be the teacher
 * of the quiz's class.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: question } = await admin
    .from("quiz_questions")
    .select("id, quiz_id, quizzes!inner(class_id, classes!inner(teacher_id))")
    .eq("id", id)
    .single();
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const quiz = (question as any).quizzes;
  const cls = quiz ? (Array.isArray(quiz.classes) ? quiz.classes[0] : quiz.classes) : null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can delete questions." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("quiz_questions").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
