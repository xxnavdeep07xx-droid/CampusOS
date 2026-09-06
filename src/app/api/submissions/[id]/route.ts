import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SubmissionStatus } from "@/lib/types";

/**
 * PATCH /api/submissions/[id]
 *
 * Body: { grade?: number | null, feedback?: string }
 *
 * Used by the teacher to grade a submission. Sets status='graded' when a
 * grade is provided; status='submitted' if grade is cleared (null).
 *
 * Auth: caller must be the teacher of the assignment's class.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: { grade?: number | null; feedback?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const grade = body.grade === undefined ? null : body.grade;
  const feedback = body.feedback ?? null;

  if (grade !== null && (Number.isNaN(grade) || grade < 0 || grade > 100)) {
    return NextResponse.json(
      { error: "Grade must be a number between 0 and 100 (or null)." },
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

  // Verify the caller is the teacher of the assignment's class.
  const { data: sub, error: subErr } = await admin
    .from("submissions")
    .select("id, assignment_id, assignments!inner(class_id, classes!inner(teacher_id))")
    .eq("id", id)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  // The nested relation returns an array — handle both shapes.
  const assignments = sub.assignments as
    | { class_id: string; classes: { teacher_id: string } | { teacher_id: string }[] } | null;
  if (!assignments) {
    return NextResponse.json(
      { error: "Could not verify class ownership." },
      { status: 500 }
    );
  }
  const clsArr = Array.isArray(assignments.classes) ? assignments.classes : [assignments.classes];
  if (!clsArr.some((c) => c.teacher_id === user.id)) {
    return NextResponse.json(
      { error: "Only the teacher of this class can grade submissions." },
      { status: 403 }
    );
  }

  const status: SubmissionStatus = grade !== null ? "graded" : "submitted";

  const { data: updated, error: updateErr } = await admin
    .from("submissions")
    .update({ grade, feedback, status })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update submission." },
      { status: 500 }
    );
  }

  return NextResponse.json({ submission: updated });
}
