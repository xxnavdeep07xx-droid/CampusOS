import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SyllabusUnit } from "@/lib/types";

/**
 * GET /api/syllabus?classId=...
 *
 * Returns syllabus units for the signed-in teacher, optionally filtered by
 * class. Always scoped to the caller's own units.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  let query = admin
    .from("syllabus_units")
    .select("*, classes(id, name)")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (classId) {
    // Verify caller is the teacher of this class.
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
      (caller?.role === "principal" || caller?.role === "staff") && caller?.school_id === cls.school_id;
    if (!isTeacher && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Only the teacher of this class or a school admin can view syllabus units." },
        { status: 403 }
      );
    }
    query = query.eq("class_id", classId);
  } else {
    query = query.eq("teacher_id", user.id);
  }

  const { data: rows, error } = await query.limit(200);

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ syllabusUnits: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ syllabusUnits: rows as SyllabusUnit[] });
}

/**
 * POST /api/syllabus
 *
 * Body: { classId?, title, description?, totalLessons?, targetDate?, status? }
 */
export async function POST(request: Request) {
  let body: {
    classId?: string | null;
    title?: string;
    description?: string;
    totalLessons?: number;
    targetDate?: string | null;
    status?: string;
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

  const totalLessons = Number(body.totalLessons ?? 1);
  if (!Number.isFinite(totalLessons) || totalLessons < 1 || totalLessons > 200) {
    return NextResponse.json(
      { error: "totalLessons must be between 1 and 200." },
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

  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;
  if (!caller || (caller.role !== "teacher" && caller.role !== "principal" && caller.role !== "staff")) {
    return NextResponse.json(
      { error: "Only teachers and school admins can create syllabus units." },
      { status: 403 }
    );
  }

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
        { error: "Only the teacher of this class can create syllabus units for it." },
        { status: 403 }
      );
    }
  }

  // Determine position: append after existing units with the highest position.
  const { data: maxRow } = await admin
    .from("syllabus_units")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((maxRow as { position: number } | null)?.position ?? -1) + 1;

  const { data: row, error: insErr } = await admin
    .from("syllabus_units")
    .insert({
      teacher_id: user.id,
      class_id: body.classId ?? null,
      title,
      description: body.description?.trim() || null,
      total_lessons: totalLessons,
      completed_lessons: 0,
      target_date: body.targetDate ?? null,
      status: (body.status as "not_started" | "in_progress" | "completed") ?? "not_started",
      position: nextPosition,
    })
    .select("*")
    .single();

  if (insErr) {
    if (/Could not find the table|does not exist/i.test(insErr.message)) {
      return NextResponse.json(
        {
          error:
            "The syllabus_units table doesn't exist yet. Apply supabase/migrations/0010_academic_hub.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ syllabusUnit: row as SyllabusUnit });
}
