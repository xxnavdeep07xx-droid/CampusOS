import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Quiz, QuizQuestion, QuestionType } from "@/lib/types";

/**
 * POST /api/quizzes
 *
 * Body: {
 *   classId, title, description?, timeLimitMinutes?, dueDate?,
 *   isPublished?,
 *   questions: Array<{
 *     question_text, question_type, options? (string[] for mcq),
 *     correct_answer, points, position?
 *   }>
 * }
 *
 * Creates the quiz + all its questions in a single transaction (via the
 * admin client). Returns the new quiz row + the questions.
 *
 * Auth: caller must be the teacher of the class (or a principal/staff of
 * the same school).
 */
export async function POST(request: Request) {
  let body: {
    classId?: string;
    title?: string;
    description?: string;
    timeLimitMinutes?: number | null;
    dueDate?: string | null;
    isPublished?: boolean;
    questions?: Array<{
      question_text: string;
      question_type: QuestionType;
      options?: string[] | null;
      correct_answer: string;
      points?: number;
      position?: number;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const title = body.title?.trim();
  const description = body.description?.trim() ?? "";
  const timeLimitMinutes = body.timeLimitMinutes ?? null;
  const dueDate = body.dueDate || null;
  const isPublished = body.isPublished === true;
  const questions = body.questions ?? [];

  if (!classId || !title) {
    return NextResponse.json(
      { error: "classId and title are required." },
      { status: 400 }
    );
  }
  if (title.length < 2) {
    return NextResponse.json(
      { error: "Title must be at least 2 characters." },
      { status: 400 }
    );
  }
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "A quiz must have at least one question." },
      { status: 400 }
    );
  }
  // Validate each question.
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question_text?.trim()) {
      return NextResponse.json(
        { error: `Question ${i + 1}: question_text is required.` },
        { status: 400 }
      );
    }
    if (!["mcq", "short_answer"].includes(q.question_type)) {
      return NextResponse.json(
        { error: `Question ${i + 1}: invalid question_type.` },
        { status: 400 }
      );
    }
    if (q.question_type === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return NextResponse.json(
          { error: `Question ${i + 1}: MCQ needs at least 2 options.` },
          { status: 400 }
        );
      }
      if (!q.options.includes(q.correct_answer)) {
        return NextResponse.json(
          {
            error: `Question ${i + 1}: correct_answer must be one of the options.`,
          },
          { status: 400 }
        );
      }
    } else {
      if (!q.correct_answer?.trim()) {
        return NextResponse.json(
          { error: `Question ${i + 1}: correct_answer is required.` },
          { status: 400 }
        );
      }
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
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === cls.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher (or a school admin) can create quizzes." },
      { status: 403 }
    );
  }

  // Insert the quiz.
  const { data: quizRow, error: quizErr } = await admin
    .from("quizzes")
    .insert({
      class_id: classId,
      author_id: user.id,
      title,
      description,
      time_limit_minutes: timeLimitMinutes,
      due_date: dueDate,
      is_published: isPublished,
    })
    .select("*")
    .single();

  if (quizErr || !quizRow) {
    return NextResponse.json(
      {
        error:
          "Could not create quiz. Make sure the Phase 5 migration has been applied — see supabase/README.md. " +
          (quizErr?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  // Insert all the questions in one batch.
  const questionRows = questions.map((q, i) => ({
    quiz_id: quizRow.id,
    question_text: q.question_text.trim(),
    question_type: q.question_type,
    options: q.question_type === "mcq" && q.options ? JSON.stringify(q.options) : null,
    correct_answer: q.correct_answer.trim(),
    points: q.points ?? 1,
    position: q.position ?? i,
  }));

  const { data: insertedQuestions, error: qErr } = await admin
    .from("quiz_questions")
    .insert(questionRows)
    .select("*");

  if (qErr || !insertedQuestions) {
    // Best-effort cleanup of the orphaned quiz row.
    await admin.from("quizzes").delete().eq("id", quizRow.id);
    return NextResponse.json(
      {
        error: "Could not create quiz questions: " + (qErr?.message ?? "unknown"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    quiz: quizRow as Quiz,
    questions: (insertedQuestions ?? []) as QuizQuestion[],
  });
}

/**
 * GET /api/quizzes?classId=...
 *
 * Returns the quizzes for a class (joined with their class name).
 * Students only see published quizzes; teachers/principals see drafts too.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json(
      { error: "Missing classId query param." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, class_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === cls.school_id;
  const isEnrolledStudent =
    profile.role === "student" && profile.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "Not authorized to view this class's quizzes." },
      { status: 403 }
    );
  }

  // Students only see published quizzes; teachers/admins see all.
  let query = admin
    .from("quizzes")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (!isTeacher && !isSchoolAdmin) {
    query = query.eq("is_published", true);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load quizzes. Make sure the Phase 5 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ quizzes: rows ?? [] });
}
