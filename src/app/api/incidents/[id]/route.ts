import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BehaviorIncident } from "@/lib/types";

/**
 * PATCH /api/incidents/[id]
 *
 * Body: { title?, description?, actionTaken?, severity?, category?, incidentDate? }
 *
 * Auth: caller must be the teacher of the student's class OR a school admin.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: {
    title?: string;
    description?: string;
    actionTaken?: string;
    severity?: string;
    category?: string;
    incidentDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = body.description.trim() || null;
  if (body.actionTaken !== undefined) patch.action_taken = body.actionTaken.trim() || null;
  if (body.severity !== undefined) {
    if (!["positive", "concern", "neutral"].includes(body.severity)) {
      return NextResponse.json({ error: "Invalid severity." }, { status: 400 });
    }
    patch.severity = body.severity;
  }
  if (body.category !== undefined) {
    if (!["academic", "behavioral", "attendance", "social", "recognition", "other"].includes(body.category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    patch.category = body.category;
  }
  if (body.incidentDate !== undefined) patch.incident_date = body.incidentDate;

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

  // Verify the caller is authorized.
  const { data: incident } = await admin
    .from("behavior_incidents")
    .select("id, student_id")
    .eq("id", id)
    .single();
  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  // Check authorization via the student's class.
  const { data: studentRow } = await admin
    .from("profiles")
    .select("id, school_id, class_id")
    .eq("id", (incident as { student_id: string }).student_id)
    .single();
  const student = studentRow as { id: string; school_id: string | null; class_id: string | null } | null;

  let isTeacher = false;
  if (student?.class_id) {
    const { data: clsRow } = await admin
      .from("classes")
      .select("teacher_id")
      .eq("id", student.class_id)
      .single();
    isTeacher = (clsRow as { teacher_id: string } | null)?.teacher_id === user.id;
  }

  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id != null &&
    caller.school_id === student?.school_id;

  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this student's class or a school admin can edit incidents." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("behavior_incidents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update incident." },
      { status: 500 }
    );
  }

  return NextResponse.json({ incident: updated as BehaviorIncident });
}

/**
 * DELETE /api/incidents/[id]
 *
 * Removes an incident. Auth: caller must be the teacher of the student's
 * class OR a school admin.
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

  const { data: incident } = await admin
    .from("behavior_incidents")
    .select("id, student_id")
    .eq("id", id)
    .single();
  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const { data: studentRow } = await admin
    .from("profiles")
    .select("id, school_id, class_id")
    .eq("id", (incident as { student_id: string }).student_id)
    .single();
  const student = studentRow as { id: string; school_id: string | null; class_id: string | null } | null;

  let isTeacher = false;
  if (student?.class_id) {
    const { data: clsRow } = await admin
      .from("classes")
      .select("teacher_id")
      .eq("id", student.class_id)
      .single();
    isTeacher = (clsRow as { teacher_id: string } | null)?.teacher_id === user.id;
  }

  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id != null &&
    caller.school_id === student?.school_id;

  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this student's class or a school admin can delete incidents." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("behavior_incidents").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
