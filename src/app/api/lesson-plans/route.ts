import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LessonPlan } from "@/lib/types";

/**
 * GET /api/lesson-plans?classId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns the teacher's lesson plans, optionally filtered by class and
 * a date range. Always scoped to the signed-in user (or school admins
 * in the same school).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const from = url.searchParams.get("from"); // YYYY-MM-DD
  const to = url.searchParams.get("to");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  let query = admin
    .from("lesson_plans")
    .select(`
      *,
      classes(id, name),
      syllabus_units(id, title)
    `)
    .order("lesson_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Scope: own lesson plans, OR if classId provided, lessons for that class
  // (the caller must own that class or be a school admin).
  if (classId) {
    const { data: clsRow } = await admin
      .from("classes")
      .select("teacher_id, school_id")
      .eq("id", classId)
      .single();
    const cls = clsRow as { teacher_id: string; school_id: string } | null;
    if (!cls) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }
    const { data: callerRow } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    const caller = callerRow as { role: string; school_id: string | null } | null;
    const isTeacher = cls.teacher_id === user.id;
    const isSchoolAdmin =
      (caller?.role === "principal" || caller?.role === "staff") &&
      caller?.school_id === cls.school_id;
    if (!isTeacher && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Only the teacher of this class or a school admin can view lesson plans." },
        { status: 403 }
      );
    }
    query = query.eq("class_id", classId);
  } else {
    // No class filter — show only the caller's own lesson plans.
    query = query.eq("teacher_id", user.id);
  }

  if (from) query = query.gte("lesson_date", from);
  if (to) query = query.lte("lesson_date", to);

  const { data: rows, error } = await query.limit(200);

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ lessonPlans: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lessonPlans: rows as LessonPlan[] });
}

/**
 * POST /api/lesson-plans
 *
 * Body: { classId?, lessonDate?, title, body?, objectives[]?, materials[]?, durationMin?, status?, syllabusUnitId? }
 *
 * Auth: caller must be a teacher (or school admin). class_id is optional
 * (for "anytime" lesson plans not tied to a specific class).
 */
export async function POST(request: Request) {
  let body: {
    classId?: string | null;
    lessonDate?: string | null;
    title?: string;
    body?: string;
    objectives?: string[];
    materials?: string[];
    durationMin?: number;
    status?: string;
    syllabusUnitId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify caller role.
  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;
  if (!caller || (caller.role !== "teacher" && caller.role !== "principal" && caller.role !== "staff")) {
    return NextResponse.json(
      { error: "Only teachers and school admins can create lesson plans." },
      { status: 403 }
    );
  }

  // If classId provided, verify the caller is the teacher of that class.
  if (body.classId) {
    const { data: clsRow } = await admin
      .from("classes")
      .select("teacher_id, school_id")
      .eq("id", body.classId)
      .single();
    const cls = clsRow as { teacher_id: string; school_id: string } | null;
    if (!cls) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }
    const isTeacher = cls.teacher_id === user.id;
    const isSchoolAdmin =
      (caller.role === "principal" || caller.role === "staff") && caller.school_id === cls.school_id;
    if (!isTeacher && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Only the teacher of this class can create lesson plans for it." },
        { status: 403 }
      );
    }
  }

  const { data: row, error: insErr } = await admin
    .from("lesson_plans")
    .insert({
      teacher_id: user.id,
      class_id: body.classId ?? null,
      lesson_date: body.lessonDate ?? null,
      title,
      body: body.body?.trim() || null,
      objectives: body.objectives ?? [],
      materials: body.materials ?? [],
      duration_min: body.durationMin ?? 45,
      status: (body.status as "draft" | "published") ?? "draft",
      syllabus_unit_id: body.syllabusUnitId ?? null,
    })
    .select("*")
    .single();

  if (insErr) {
    if (/Could not find the table|does not exist/i.test(insErr.message)) {
      return NextResponse.json(
        {
          error:
            "The lesson_plans table doesn't exist yet. Apply supabase/migrations/0010_academic_hub.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ lessonPlan: row as LessonPlan });
}
