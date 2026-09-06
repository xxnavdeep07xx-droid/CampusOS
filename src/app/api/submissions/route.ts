import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Submission } from "@/lib/types";

/**
 * POST /api/submissions
 *
 * Body: { assignmentId, filePath }
 *
 * Auth: caller must be a student whose profile.class_id matches the
 * assignment's class.
 *
 * If a submission already exists for this (assignment, student) pair, it is
 * updated (UPSERT) — the unique index `submissions_unique_per_student_assignment`
 * enforces one submission per student per assignment.
 */
export async function POST(request: Request) {
  let body: { assignmentId?: string; filePath?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const assignmentId = body.assignmentId?.trim();
  const filePath = body.filePath?.trim();
  if (!assignmentId || !filePath) {
    return NextResponse.json(
      { error: "assignmentId and filePath are required." },
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

  // Fetch the assignment + the assignment's class to verify the student is
  // enrolled in that class.
  const { data: assignment, error: aErr } = await admin
    .from("assignments")
    .select("id, class_id")
    .eq("id", assignmentId)
    .single();

  if (aErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, school_id, role, class_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "Your profile could not be loaded." },
      { status: 403 }
    );
  }
  if (profile.role !== "student") {
    return NextResponse.json(
      { error: "Only students can submit assignments." },
      { status: 403 }
    );
  }
  if (profile.class_id !== assignment.class_id) {
    return NextResponse.json(
      {
        error:
          "You can only submit assignments for the class you're enrolled in.",
      },
      { status: 403 }
    );
  }

  // UPSERT — reuse the unique constraint on (assignment_id, student_id).
  const { data: row, error: insErr } = await supabase
    .from("submissions")
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: user.id,
        file_path: filePath,
        status: "submitted",
        grade: null,
        feedback: null,
      },
      { onConflict: "assignment_id,student_id" }
    )
    .select("*")
    .single();

  if (insErr) {
    // Fall back to admin client in case the migration isn't applied yet.
    const { data: adminRow, error: adminErr } = await admin
      .from("submissions")
      .upsert(
        {
          assignment_id: assignmentId,
          student_id: user.id,
          file_path: filePath,
          status: "submitted",
          grade: null,
          feedback: null,
        },
        { onConflict: "assignment_id,student_id" }
      )
      .select("*")
      .single();

    if (adminErr || !adminRow) {
      return NextResponse.json(
        {
          error:
            "Could not submit. Make sure the Phase 2 migration has been applied — see supabase/README.md. " +
            (adminErr?.message ?? insErr.message),
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ submission: adminRow as Submission });
  }

  return NextResponse.json({ submission: row as Submission });
}

/**
 * GET /api/submissions?assignmentId=...
 *
 * Returns all submissions for a given assignment (teacher view).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const assignmentId = url.searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json(
      { error: "Missing assignmentId query param." },
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
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id, classes(teacher_id)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  const cls = assignment.classes as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can view submissions." },
      { status: 403 }
    );
  }

  const { data: submissions, error } = await admin
    .from("submissions")
    .select("*, student:profiles!submissions_student_id_fkey(id, full_name)")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load submissions. Make sure the Phase 2 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ submissions });
}
