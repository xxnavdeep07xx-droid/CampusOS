import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, AttendanceStatus } from "@/lib/types";

/**
 * POST /api/attendance
 *
 * Body: {
 *   classId: string,
 *   date: string,                    // YYYY-MM-DD
 *   records: Array<{ studentId: string, status: AttendanceStatus }>
 * }
 *
 * Performs a BATCH UPSSERT — for each record, inserts a new attendance row
 * or updates the existing one (matching the unique (class_id, student_id, date)
 * constraint). Used by the teacher's attendance taker "Save Attendance" button.
 *
 * Auth: caller must be the teacher of the class. RLS enforced server-side,
 * but we eagerly check for a friendlier error.
 *
 * Returns the upserted rows.
 */
export async function POST(request: Request) {
  let body: {
    classId?: string;
    date?: string;
    records?: Array<{ studentId: string; status: AttendanceStatus }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const classId = body.classId?.trim();
  const date = body.date?.trim();
  const records = body.records ?? [];

  if (!classId || !date || records.length === 0) {
    return NextResponse.json(
      { error: "classId, date, and at least one record are required." },
      { status: 400 }
    );
  }

  // Validate the date format (YYYY-MM-DD).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return NextResponse.json(
      { error: `Invalid date format: ${date}. Expected YYYY-MM-DD.` },
      { status: 400 }
    );
  }

  // Validate the statuses.
  const validStatuses: AttendanceStatus[] = ["present", "absent", "late"];
  for (const r of records) {
    if (!validStatuses.includes(r.status)) {
      return NextResponse.json(
        { error: `Invalid status: ${r.status}. Must be one of: present, absent, late.` },
        { status: 400 }
      );
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Verify the caller is the teacher of this class.
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
      { error: "Only the teacher of this class can mark attendance." },
      { status: 403 }
    );
  }

  // Build the upsert payload.
  const rows = records.map((r) => ({
    class_id: classId,
    student_id: r.studentId,
    date,
    status: r.status,
  }));

  // Use the admin client so we bypass any RLS edge cases with batch upserts
  // (the user's session client would also work, but the admin client is more
  // reliable when the Phase 3 migration hasn't fully propagated to the schema
  // cache yet).
  const { data: upserted, error: upsertErr } = await admin
    .from("attendance")
    .upsert(rows, {
      onConflict: "class_id,student_id,date",
      ignoreDuplicates: false,
    })
    .select("*");

  if (upsertErr) {
    return NextResponse.json(
      {
        error:
          "Could not save attendance. Make sure the Phase 3 migration has been applied — see supabase/README.md. " +
          upsertErr.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    saved: (upserted ?? []) as Attendance[],
    count: (upserted ?? []).length,
  });
}

/**
 * GET /api/attendance?classId=...&date=YYYY-MM-DD
 * GET /api/attendance?studentId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Two modes:
 *   - Teacher mode: returns attendance for one class on one date.
 *   - Student mode: returns the caller's attendance history in a date range.
 *
 * Both modes return rows joined with the student's profile (for teacher mode)
 * so the UI doesn't need a second round-trip.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const date = url.searchParams.get("date");
  const studentId = url.searchParams.get("studentId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // ----- Teacher mode -----
  if (classId && date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return NextResponse.json(
        { error: `Invalid date: ${date}. Expected YYYY-MM-DD.` },
        { status: 400 }
      );
    }

    // Verify the caller is allowed to view this class's attendance.
    const admin = createAdminClient();
    const { data: cls } = await admin
      .from("classes")
      .select("id, teacher_id, school_id")
      .eq("id", classId)
      .single();
    if (!cls) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, school_id, class_id")
      .eq("id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    const isTeacher = cls.teacher_id === user.id;
    const isSchoolAdmin =
      (profile.role === "principal" || profile.role === "staff") &&
      profile.school_id === cls.school_id;
    const isEnrolledStudent =
      profile.role === "student" && profile.class_id === classId;
    if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
      return NextResponse.json(
        { error: "Not authorized to view this class's attendance." },
        { status: 403 }
      );
    }

    // Fetch existing attendance rows for this class+date, joined with student.
    const { data: rows, error } = await admin
      .from("attendance")
      .select("*, student:profiles!attendance_student_id_fkey(id, full_name)")
      .eq("class_id", classId)
      .eq("date", date)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error:
            "Could not load attendance. Make sure the Phase 3 migration has been applied. " +
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ records: rows ?? [] });
  }

  // ----- Student mode -----
  if (studentId) {
    if (studentId !== user.id) {
      // Only the student themselves (or a teacher of their class) can view
      // their attendance history. We let the RLS policy handle the actual
      // filtering — here we just refuse obvious mismatches.
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (callerProfile?.role !== "principal" && callerProfile?.role !== "staff" && callerProfile?.role !== "teacher") {
        return NextResponse.json(
          { error: "You can only view your own attendance history." },
          { status: 403 }
        );
      }
    }

    let query = supabase
      .from("attendance")
      .select("*, classes(name)")
      .eq("student_id", studentId)
      .order("date", { ascending: false });

    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json(
        {
          error:
            "Could not load attendance history. Make sure the Phase 3 migration has been applied. " +
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ records: rows ?? [] });
  }

  return NextResponse.json(
    { error: "Provide either (classId + date) or (studentId)." },
    { status: 400 }
  );
}
