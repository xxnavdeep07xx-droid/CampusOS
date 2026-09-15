import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BehaviorIncident } from "@/lib/types";

/**
 * GET /api/incidents?studentId=...&classId=...
 *
 * Returns incidents for a single student OR all incidents for a class.
 * Auth: caller must be the student's class teacher, a school admin, the
 * student themselves, or the student's parent (via parent_student_links).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const classId = url.searchParams.get("classId");

  if (!studentId && !classId) {
    return NextResponse.json(
      { error: "Either studentId or classId is required." },
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

  // Verify the caller is authorized to see this student's / class's incidents.
  // We fetch the student's class_id + school_id to check.
  if (studentId) {
    const { data: studentRow } = await admin
      .from("profiles")
      .select("id, role, school_id, class_id")
      .eq("id", studentId)
      .single();
    if (!studentRow) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }
    const student = studentRow as { id: string; role: string; school_id: string | null; class_id: string | null };

    // Caller is the student themselves.
    if (student.id !== user.id) {
      // Or the teacher of the student's class.
      let isTeacher = false;
      if (student.class_id) {
        const { data: clsRow } = await admin
          .from("classes")
          .select("teacher_id")
          .eq("id", student.class_id)
          .single();
        isTeacher = (clsRow as { teacher_id: string } | null)?.teacher_id === user.id;
      }
      // Or a parent linked via parent_student_links.
      const { data: linkRow } = await admin
        .from("parent_student_links")
        .select("parent_id")
        .eq("parent_id", user.id)
        .eq("student_id", studentId)
        .maybeSingle();
      const isParent = !!linkRow;

      // Or a school admin in the same school.
      const { data: callerRow } = await admin
        .from("profiles")
        .select("role, school_id")
        .eq("id", user.id)
        .single();
      const caller = callerRow as { role: string; school_id: string | null } | null;
      const isSchoolAdmin =
        (caller?.role === "principal" || caller?.role === "staff") &&
        caller?.school_id != null &&
        caller.school_id === student.school_id;

      if (!isTeacher && !isParent && !isSchoolAdmin) {
        return NextResponse.json(
          { error: "Not authorized to view this student's incidents." },
          { status: 403 }
        );
      }
    }
  } else if (classId) {
    // Verify the caller is the teacher of the class.
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
      caller?.school_id != null &&
      caller.school_id === cls.school_id;
    if (!isTeacher && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Only the teacher of this class can view class-wide incidents." },
        { status: 403 }
      );
    }
  }

  // Build the query.
  let query = admin
    .from("behavior_incidents")
    .select(`
      *,
      student:profiles!behavior_incidents_student_id_fkey(id, full_name),
      recorder:profiles!behavior_incidents_recorded_by_fkey(id, full_name),
      classes(id, name)
    `)
    .order("incident_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (studentId) query = query.eq("student_id", studentId);
  if (classId) query = query.eq("class_id", classId);

  const { data: rows, error } = await query;

  if (error) {
    // Tolerate missing table on fresh deploys — return empty list instead
    // of error so the page doesn't crash.
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ incidents: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ incidents: rows as BehaviorIncident[] });
}

/**
 * POST /api/incidents
 *
 * Body: { studentId, classId?, incidentDate, severity, category, title, description?, actionTaken? }
 *
 * Auth: caller must be the teacher of the student's class, or a school admin.
 */
export async function POST(request: Request) {
  let body: {
    studentId?: string;
    classId?: string | null;
    incidentDate?: string;
    severity?: string;
    category?: string;
    title?: string;
    description?: string;
    actionTaken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const studentId = body.studentId?.trim();
  const classId = body.classId?.trim() || null;
  const incidentDate = body.incidentDate?.trim();
  const severity = body.severity?.trim();
  const category = body.category?.trim();
  const title = body.title?.trim();
  const description = body.description?.trim() || null;
  const actionTaken = body.actionTaken?.trim() || null;

  if (!studentId || !incidentDate || !severity || !category || !title) {
    return NextResponse.json(
      { error: "studentId, incidentDate, severity, category, and title are required." },
      { status: 400 }
    );
  }
  const validSeverities = ["positive", "concern", "neutral"];
  if (!validSeverities.includes(severity)) {
    return NextResponse.json(
      { error: `severity must be one of: ${validSeverities.join(", ")}` },
      { status: 400 }
    );
  }
  const validCategories = ["academic", "behavioral", "attendance", "social", "recognition", "other"];
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${validCategories.join(", ")}` },
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

  // Verify the caller is the teacher of the student's class OR a school admin.
  const { data: studentRow } = await admin
    .from("profiles")
    .select("id, school_id, class_id")
    .eq("id", studentId)
    .single();
  const student = studentRow as { id: string; school_id: string | null; class_id: string | null } | null;
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  let isTeacher = false;
  if (student.class_id) {
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
    caller.school_id === student.school_id;

  if (!isTeacher && !isSchoolAdmin) {
    return NextResponse.json(
      { error: "Only the teacher of this student's class or a school admin can log incidents." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await admin
    .from("behavior_incidents")
    .insert({
      student_id: studentId,
      class_id: classId ?? student.class_id,
      recorded_by: user.id,
      incident_date: incidentDate,
      severity,
      category,
      title,
      description,
      action_taken: actionTaken,
    })
    .select("*")
    .single();

  if (insErr) {
    if (/Could not find the table|does not exist/i.test(insErr.message)) {
      return NextResponse.json(
        {
          error:
            "The behavior_incidents table doesn't exist yet. Apply supabase/migrations/0009_behavior_incidents.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ incident: row as BehaviorIncident });
}
