import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizAttempt } from "@/lib/types";

/**
 * POST /api/quiz-attempts
 *
 * Body: { quizId }
 *
 * Starts a new attempt (or returns the existing in-progress one).
 * The unique partial index on (quiz_id, student_id) WHERE status='in_progress'
 * means each student has at most one in-progress attempt per quiz — starting
 * again returns the existing one.
 *
 * Auth: caller must be a student enrolled in the quiz's class.
 */
export async function POST(request: Request) {
  let body: { quizId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const quizId = body.quizId?.trim();
  if (!quizId) {
    return NextResponse.json(
      { error: "quizId is required." },
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
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, class_id, is_published")
    .eq("id", quizId)
    .single();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }
  if (!quiz.is_published) {
    return NextResponse.json(
      { error: "This quiz is not yet published." },
      { status: 403 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, class_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (profile.role !== "student") {
    return NextResponse.json(
      { error: "Only students can take quizzes." },
      { status: 403 }
    );
  }
  if (profile.class_id !== quiz.class_id) {
    return NextResponse.json(
      { error: "You can only take quizzes for your enrolled class." },
      { status: 403 }
    );
  }

  // Check if the student already has a completed attempt — if so, block
  // re-taking (one attempt per student per quiz, per the spec's implied
  // "auto-submit" semantics).
  const { data: existing } = await admin
    .from("quiz_attempts")
    .select("id, status, score, max_score, completed_at")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status === "completed") {
    return NextResponse.json({
      attempt: existing,
      alreadyCompleted: true,
      message: "You have already submitted this quiz.",
    });
  }

  // Return the existing in-progress attempt if there is one.
  if (existing && existing.status === "in_progress") {
    return NextResponse.json({ attempt: existing });
  }

  // Otherwise insert a new in-progress attempt.
  const { data: row, error: insErr } = await admin
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

  if (insErr || !row) {
    return NextResponse.json(
      {
        error:
          "Could not start attempt. Make sure the Phase 5 migration has been applied. " +
          (insErr?.message ?? "unknown"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ attempt: row as QuizAttempt });
}

/**
 * GET /api/quiz-attempts?quizId=...   (teacher: list all attempts for a quiz)
 * GET /api/quiz-attempts?studentId=... (student: list their own attempts)
 *
 * Both return attempts joined with their quiz + class.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const quizId = url.searchParams.get("quizId");
  const studentId = url.searchParams.get("studentId");

  if (!quizId && !studentId) {
    return NextResponse.json(
      { error: "Provide either quizId or studentId." },
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

  let query = admin
    .from("quiz_attempts")
    .select(
      "*, quiz:quizzes(id, title, class_id, time_limit_minutes, due_date, classes(id, name))"
    )
    .order("created_at", { ascending: false });

  if (quizId) {
    // Teacher mode — verify ownership.
    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, class_id, classes!inner(teacher_id)")
      .eq("id", quizId)
      .single();
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }
    const cls = (
      Array.isArray(quiz.classes) ? quiz.classes[0] : quiz.classes
    ) as { teacher_id: string } | null;
    if (!cls || cls.teacher_id !== user.id) {
      // Fall back to checking if the caller is a school admin.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, school_id")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "principal" && profile?.role !== "staff") {
        return NextResponse.json(
          { error: "Not authorized to view attempts for this quiz." },
          { status: 403 }
        );
      }
    }
    query = query.eq("quiz_id", quizId);
  } else if (studentId) {
    // Student mode — caller must be requesting their own attempts.
    if (studentId !== user.id) {
      return NextResponse.json(
        { error: "You can only view your own attempts." },
        { status: 403 }
      );
    }
    query = query.eq("student_id", studentId);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load attempts. Make sure the Phase 5 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ attempts: rows ?? [] });
}
