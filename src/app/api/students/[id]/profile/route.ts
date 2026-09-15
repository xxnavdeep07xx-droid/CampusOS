import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/students/[id]/profile
 *
 * Body: { parentContact?, parentPhone?, behavioralNotes? }
 *
 * Lets a teacher (or school admin) update the parent_contact, parent_phone,
 * and behavioral_notes columns on a student's profile.
 *
 * Auth: caller must be the teacher of the student's class, or a school
 * admin. The SQL trigger installed in migration 0009 enforces column-level
 * restrictions at the DB layer (so even if the API is bypassed, role /
 * school_id can't be escalated).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const studentId = params.id;

  let body: {
    parentContact?: string;
    parentPhone?: string;
    behavioralNotes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.parentContact !== undefined) patch.parent_contact = body.parentContact.trim();
  if (body.parentPhone !== undefined) patch.parent_phone = body.parentPhone.trim();
  if (body.behavioralNotes !== undefined) patch.behavioral_notes = body.behavioralNotes.trim();

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

  // Fetch the student + caller in parallel.
  const [{ data: studentRow }, { data: callerRow }] = await Promise.all([
    admin.from("profiles").select("id, school_id, class_id, role").eq("id", studentId).single(),
    admin.from("profiles").select("id, role, school_id").eq("id", user.id).single(),
  ]);
  const student = studentRow as { id: string; school_id: string | null; class_id: string | null; role: string } | null;
  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  const caller = callerRow as { id: string; role: string; school_id: string | null } | null;
  if (!caller) {
    return NextResponse.json({ error: "Caller profile not found." }, { status: 403 });
  }

  // Authorization: caller must be the teacher of the student's class OR a
  // school admin in the same school.
  let isTeacher = false;
  if (student.class_id) {
    const { data: clsRow } = await admin
      .from("classes")
      .select("teacher_id")
      .eq("id", student.class_id)
      .single();
    isTeacher = (clsRow as { teacher_id: string } | null)?.teacher_id === user.id;
  }
  const isSchoolAdmin =
    (caller.role === "principal" || caller.role === "staff") &&
    caller.school_id != null &&
    caller.school_id === student.school_id;
  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this student's class or a school admin can edit this profile." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", studentId)
    .select("id, parent_contact, parent_phone, behavioral_notes")
    .single();

  if (updateErr || !updated) {
    // Migration 0009 may not be applied yet — the columns won't exist.
    if (/Could not find the column|does not exist/i.test(updateErr?.message ?? "")) {
      return NextResponse.json(
        {
          error:
            "The parent_contact / parent_phone / behavioral_notes columns don't exist yet. Apply supabase/migrations/0009_behavior_incidents.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: updated });
}
