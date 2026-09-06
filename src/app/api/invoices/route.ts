import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FeeInvoice } from "@/lib/types";

/**
 * POST /api/invoices
 *
 * Body (single invoice):
 *   { schoolId, studentId, title, description?, totalAmount, dueDate? }
 *
 * Body (batch by class):
 *   { schoolId, classId, title, description?, totalAmount, dueDate? }
 *   → creates one invoice per student enrolled in that class.
 *
 * Auth: caller must be a principal or staff of the school.
 */
export async function POST(request: Request) {
  let body: {
    schoolId?: string;
    studentId?: string;
    classId?: string;
    title?: string;
    description?: string;
    totalAmount?: number | string;
    dueDate?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const schoolId = body.schoolId?.trim();
  const title = body.title?.trim();
  const description = body.description?.trim() ?? "";
  const totalAmount =
    typeof body.totalAmount === "string"
      ? parseFloat(body.totalAmount)
      : body.totalAmount;
  const dueDate = body.dueDate || null;
  const studentId = body.studentId?.trim() || null;
  const classId = body.classId?.trim() || null;

  if (!schoolId || !title || totalAmount == null) {
    return NextResponse.json(
      { error: "schoolId, title, and totalAmount are required." },
      { status: 400 }
    );
  }
  if (!studentId && !classId) {
    return NextResponse.json(
      { error: "Either studentId or classId is required." },
      { status: 400 }
    );
  }
  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return NextResponse.json(
      { error: "totalAmount must be a non-negative number." },
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (profile.role !== "principal" && profile.role !== "staff") {
    return NextResponse.json(
      { error: "Only principals and staff can create invoices." },
      { status: 403 }
    );
  }
  if (profile.school_id !== schoolId) {
    return NextResponse.json(
      { error: "School ID doesn't match your profile." },
      { status: 403 }
    );
  }

  // Build the list of student IDs to invoice.
  let studentIds: string[] = [];
  if (studentId) {
    studentIds = [studentId];
  } else if (classId) {
    const { data: students, error: sErr } = await admin
      .from("profiles")
      .select("id")
      .eq("class_id", classId)
      .eq("role", "student");
    if (sErr) {
      return NextResponse.json(
        { error: "Could not fetch class students: " + sErr.message },
        { status: 500 }
      );
    }
    studentIds = (students ?? []).map((s) => (s as { id: string }).id);
    if (studentIds.length === 0) {
      return NextResponse.json(
        { error: "No students enrolled in that class." },
        { status: 400 }
      );
    }
  }

  const rows = studentIds.map((sid) => ({
    school_id: schoolId,
    student_id: sid,
    title,
    description,
    total_amount: totalAmount,
    due_date: dueDate,
    status: "pending" as const,
    created_by: user.id,
  }));

  const { data: inserted, error: insErr } = await admin
    .from("fee_invoices")
    .insert(rows)
    .select("*");

  if (insErr || !inserted) {
    return NextResponse.json(
      {
        error:
          "Could not create invoices. Make sure the Phase 6 migration has been applied — see supabase/README.md. " +
          (insErr?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invoices: inserted as FeeInvoice[],
    count: inserted.length,
  });
}

/**
 * GET /api/invoices?schoolId=...           (admin: all invoices in school)
 * GET /api/invoices?studentId=...           (student/parent: own invoices)
 *
 * Returns invoices joined with the student profile (for admin view).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const studentId = url.searchParams.get("studentId");

  if (!schoolId && !studentId) {
    return NextResponse.json(
      { error: "Provide either schoolId or studentId." },
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  let query = admin
    .from("fee_invoices")
    .select("*, student:profiles!fee_invoices_student_id_fkey(id, full_name)")
    .order("created_at", { ascending: false });

  if (schoolId) {
    // Admin mode — verify caller is principal/staff of the school.
    if (
      profile.role !== "principal" &&
      profile.role !== "staff" &&
      profile.school_id !== schoolId
    ) {
      return NextResponse.json(
        { error: "Not authorized to view this school's invoices." },
        { status: 403 }
      );
    }
    query = query.eq("school_id", schoolId);
  } else if (studentId) {
    // Student/parent mode — caller must be the student themselves or a
    // linked parent.
    if (studentId !== user.id) {
      // Check if caller is a parent of this student.
      const { data: link } = await admin
        .from("parent_student_links")
        .select("id")
        .eq("parent_id", user.id)
        .eq("student_id", studentId)
        .maybeSingle();
      if (!link) {
        return NextResponse.json(
          { error: "Not authorized to view this student's invoices." },
          { status: 403 }
        );
      }
    }
    query = query.eq("student_id", studentId);
  }

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load invoices. Make sure the Phase 6 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ invoices: rows ?? [] });
}
