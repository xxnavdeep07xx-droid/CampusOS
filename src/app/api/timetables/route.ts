import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Timetable, DayOfWeek } from "@/lib/types";

/**
 * POST /api/timetables
 *
 * Body: { classId, dayOfWeek (1-5), startTime "HH:MM", endTime "HH:MM", subjectName? }
 *
 * Auth: caller must be the teacher of the class. RLS enforced server-side.
 */
export async function POST(request: Request) {
  let body: {
    classId?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    subjectName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const dayOfWeek = body.dayOfWeek;
  const startTime = body.startTime?.trim();
  const endTime = body.endTime?.trim();
  const subjectName = body.subjectName?.trim() ?? "";

  if (!classId || !dayOfWeek || !startTime || !endTime) {
    return NextResponse.json(
      { error: "classId, dayOfWeek, startTime, and endTime are required." },
      { status: 400 }
    );
  }
  if (dayOfWeek < 1 || dayOfWeek > 5) {
    return NextResponse.json(
      { error: "dayOfWeek must be between 1 (Monday) and 5 (Friday)." },
      { status: 400 }
    );
  }
  if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) {
    return NextResponse.json(
      { error: "startTime and endTime must be in HH:MM format." },
      { status: 400 }
    );
  }
  // Compare as "HH:MM" strings — works lexicographically for 24h format.
  if (startTime >= endTime) {
    return NextResponse.json(
      { error: "startTime must be before endTime." },
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
  const { data: cls, error: clsErr } = await admin
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .single();
  if (clsErr || !cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can create timetable slots." },
      { status: 403 }
    );
  }

  // Insert — the EXCLUDE constraint in the DB will reject overlapping slots
  // for the same class+day. Surface that as a friendly error.
  const { data: row, error: insErr } = await admin
    .from("timetables")
    .insert({
      class_id: classId,
      day_of_week: dayOfWeek as DayOfWeek,
      start_time: startTime,
      end_time: endTime,
      subject_name: subjectName,
    })
    .select("*")
    .single();

  if (insErr) {
    const msg = insErr.message.toLowerCase();
    if (msg.includes("overlap") || msg.includes("timetables_no_overlap")) {
      return NextResponse.json(
        { error: "This time slot overlaps with an existing slot for the same class on the same day." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Could not create timetable slot. Make sure the Phase 3 migration has been applied — see supabase/README.md. " +
          insErr.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ timetable: row as Timetable });
}

/**
 * GET /api/timetables?classId=...            → all slots for one class
 * GET /api/timetables?teacherId=...          → all slots for all classes the teacher owns
 *
 * Returns the slots joined with their class so the UI can render a weekly grid.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const teacherId = url.searchParams.get("teacherId");

  if (!classId && !teacherId) {
    return NextResponse.json(
      { error: "Provide either classId or teacherId." },
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

  // Build a query that joins timetables with their class.
  let query = admin
    .from("timetables")
    .select("*, classes(id, name)")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (classId) {
    query = query.eq("class_id", classId);
  } else if (teacherId) {
    // teacherId mode — fetch the teacher's classes first, then their slots.
    const { data: classes } = await admin
      .from("classes")
      .select("id")
      .eq("teacher_id", teacherId);
    const classIds = (classes ?? []).map((c) => (c as { id: string }).id);
    if (classIds.length === 0) {
      return NextResponse.json({ timetables: [] });
    }
    query = query.in("class_id", classIds);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load timetables. Make sure the Phase 3 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ timetables: rows ?? [] });
}
