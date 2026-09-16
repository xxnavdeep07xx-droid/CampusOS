import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SyllabusUnit, SyllabusUnitStatus } from "@/lib/types";

/**
 * PATCH /api/syllabus/[id]
 *
 * Body: { title?, description?, totalLessons?, completedLessons?, targetDate?, status? }
 *
 * When completedLessons changes, the status is auto-derived: 0 = not_started,
 * total = completed, otherwise in_progress.
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
    totalLessons?: number;
    completedLessons?: number;
    targetDate?: string | null;
    status?: SyllabusUnitStatus;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = body.title.trim();
    if (t.length < 2) {
      return NextResponse.json({ error: "Title must be at least 2 characters." }, { status: 400 });
    }
    patch.title = t;
  }
  if (body.description !== undefined) patch.description = body.description.trim() || null;
  if (body.targetDate !== undefined) patch.target_date = body.targetDate ?? null;

  // Read existing row first to validate total/completed combinations.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("syllabus_units")
    .select("id, teacher_id, total_lessons, completed_lessons")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Syllabus unit not found." }, { status: 404 });
  }
  const ex = existing as { id: string; teacher_id: string; total_lessons: number; completed_lessons: number };
  if (ex.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can edit this syllabus unit." },
      { status: 403 }
    );
  }

  let totalLessons = ex.total_lessons;
  let completedLessons = ex.completed_lessons;
  if (body.totalLessons !== undefined) {
    const t = Number(body.totalLessons);
    if (!Number.isFinite(t) || t < 1 || t > 200) {
      return NextResponse.json({ error: "totalLessons must be 1–200." }, { status: 400 });
    }
    totalLessons = t;
    patch.total_lessons = t;
  }
  if (body.completedLessons !== undefined) {
    const c = Number(body.completedLessons);
    if (!Number.isFinite(c) || c < 0 || c > totalLessons) {
      return NextResponse.json(
        { error: `completedLessons must be between 0 and ${totalLessons}.` },
        { status: 400 }
      );
    }
    completedLessons = c;
    patch.completed_lessons = c;
  }

  // Auto-derive status unless caller provided an explicit one.
  if (body.status !== undefined) {
    if (!["not_started", "in_progress", "completed"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = body.status;
  } else if (body.completedLessons !== undefined || body.totalLessons !== undefined) {
    if (completedLessons === 0) patch.status = "not_started";
    else if (completedLessons >= totalLessons) patch.status = "completed";
    else patch.status = "in_progress";
  }
  patch.updated_at = new Date().toISOString();

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await admin
    .from("syllabus_units")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update syllabus unit." },
      { status: 500 }
    );
  }

  return NextResponse.json({ syllabusUnit: updated as SyllabusUnit });
}

/**
 * DELETE /api/syllabus/[id]
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

  const { data: existing } = await admin
    .from("syllabus_units")
    .select("id, teacher_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Syllabus unit not found." }, { status: 404 });
  }
  if ((existing as { teacher_id: string }).teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete this syllabus unit." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("syllabus_units").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
