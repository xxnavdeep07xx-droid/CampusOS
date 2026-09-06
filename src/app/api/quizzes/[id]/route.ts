import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Quiz, QuizQuestion } from "@/lib/types";

/**
 * GET /api/quizzes/[id]
 *
 * Returns a single quiz + all its questions (ordered by position).
 *
 * Students only see published quizzes; teachers see drafts too.
 *
 * The `correct_answer` field is **stripped** for students — they should
 * not be able to fetch the answers via the API. The teacher version
 * keeps the correct_answer field for editing.
 */
export async function GET(
  request: Request,
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
  const { data: quiz } = await admin
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  // Authorize: caller must be the teacher, a school admin, or a student
  // enrolled in the class that owns the quiz.
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", quiz.class_id)
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
    profile.role === "student" && profile.class_id === quiz.class_id;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "Not authorized to view this quiz." },
      { status: 403 }
    );
  }

  // Students can't see unpublished quizzes.
  if (!isTeacher && !isSchoolAdmin && !quiz.is_published) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  // Fetch questions ordered by position.
  const { data: questionRows, error: qErr } = await admin
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", id)
    .order("position", { ascending: true });
  if (qErr) {
    return NextResponse.json(
      { error: "Could not load questions: " + qErr.message },
      { status: 500 }
    );
  }

  // Strip correct_answer for students — they shouldn't see it via the API.
  // (Teachers need it for editing.)
  const questions = (questionRows ?? []).map((q) => {
    if (!isTeacher && !isSchoolAdmin) {
      const { correct_answer: _omit, ...rest } = q as QuizQuestion & {
        correct_answer: string;
      };
      void _omit;
      return rest;
    }
    return q;
  }) as QuizQuestion[];

  return NextResponse.json({
    quiz: quiz as Quiz,
    questions,
  });
}

/**
 * DELETE /api/quizzes/[id]
 *
 * Removes a quiz + (via CASCADE) all its questions + attempts.
 */
export async function DELETE(
  request: Request,
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
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", id)
    .single();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }
  const cls = (
    Array.isArray(quiz.classes) ? quiz.classes[0] : quiz.classes
  ) as { teacher_id: string } | null;
  if (!cls) {
    return NextResponse.json(
      { error: "Could not verify class ownership." },
      { status: 500 }
    );
  }
  if (cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher can delete this quiz." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("quizzes").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
