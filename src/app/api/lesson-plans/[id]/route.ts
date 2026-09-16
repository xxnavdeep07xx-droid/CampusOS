import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LessonPlan } from "@/lib/types";

/**
 * PATCH /api/lesson-plans/[id]
 *
 * Body: any subset of { classId, lessonDate, title, body, objectives, materials, durationMin, status, syllabusUnitId }
 *
 * Auth: caller must be the lesson plan's teacher (teacher_id field).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.classId !== undefined) patch.class_id = body.classId ?? null;
  if (body.lessonDate !== undefined) patch.lesson_date = body.lessonDate ?? null;
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (t.length < 2) {
      return NextResponse.json(
        { error: "Title must be at least 2 characters." },
        { status: 400 }
      );
    }
    patch.title = t;
  }
  if (body.body !== undefined) patch.body = String(body.body).trim() || null;
  if (body.objectives !== undefined) {
    if (!Array.isArray(body.objectives)) {
      return NextResponse.json({ error: "objectives must be an array." }, { status: 400 });
    }
    patch.objectives = body.objectives.map((s: unknown) => String(s).trim()).filter(Boolean);
  }
  if (body.materials !== undefined) {
    if (!Array.isArray(body.materials)) {
      return NextResponse.json({ error: "materials must be an array." }, { status: 400 });
    }
    patch.materials = body.materials.map((s: unknown) => String(s).trim()).filter(Boolean);
  }
  if (body.durationMin !== undefined) {
    const d = Number(body.durationMin);
    if (!Number.isFinite(d) || d < 1 || d > 600) {
      return NextResponse.json(
        { error: "durationMin must be a number between 1 and 600." },
        { status: 400 }
      );
    }
    patch.duration_min = d;
  }
  if (body.status !== undefined) {
    if (!["draft", "published"].includes(String(body.status))) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.syllabusUnitId !== undefined) patch.syllabus_unit_id = body.syllabusUnitId ?? null;
  patch.updated_at = new Date().toISOString();

  if (Object.keys(patch).length === 1) {
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

  // Verify ownership.
  const { data: existing } = await admin
    .from("lesson_plans")
    .select("id, teacher_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Lesson plan not found." }, { status: 404 });
  }
  if ((existing as { teacher_id: string }).teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can edit this lesson plan." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("lesson_plans")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not update lesson plan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ lessonPlan: updated as LessonPlan });
}

/**
 * DELETE /api/lesson-plans/[id]
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
    .from("lesson_plans")
    .select("id, teacher_id")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Lesson plan not found." }, { status: 404 });
  }
  if ((existing as { teacher_id: string }).teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete this lesson plan." },
      { status: 403 }
    );
  }

  const { error: delErr } = await admin.from("lesson_plans").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
