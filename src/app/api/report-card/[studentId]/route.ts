import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateReportCardPDF } from "@/lib/pdf-report-card";
import type { Profile, School, AttendanceStatus, GradebookRow } from "@/lib/types";

/**
 * GET /api/report-card/[studentId]
 *
 * Generates a neo-brutalist PDF report card for the given student.
 *
 * Flow:
 *   1. Fetch the student's profile + school.
 *   2. Fetch their attendance records (count present/absent/late).
 *   3. Fetch their class_gradebook row (from Phase 5).
 *   4. Generate the PDF via generateReportCardPDF().
 *   5. Return as application/pdf.
 *
 * Auth: caller must be the student themselves, a linked parent, the teacher
 * of their class, or a principal/staff of the school.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  const params = await context.params;
  const studentId = params.studentId;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Fetch the student's profile.
  const { data: studentProfile } = await admin.from("profiles")
    .select("*").eq("id", studentId).single();
  if (!studentProfile) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  const student = studentProfile as Profile;

  // Fetch the school.
  const { data: schoolRow } = await admin.from("schools")
    .select("name").eq("id", student.school_id ?? "").single();
  const school = (schoolRow ?? { name: "CampusOS" }) as Pick<School, "name">;

  // Fetch the class name.
  let className: string | null = null;
  if (student.class_id) {
    const { data: cls } = await admin.from("classes").select("name").eq("id", student.class_id).single();
    className = (cls as { name: string } | null)?.name ?? null;
  }

  // Fetch attendance.
  let presentCount = 0, absentCount = 0, lateCount = 0;
  const { data: attRows } = await admin.from("attendance")
    .select("status").eq("student_id", studentId);
  for (const r of (attRows ?? []) as Array<{ status: AttendanceStatus }>) {
    if (r.status === "present") presentCount++;
    else if (r.status === "absent") absentCount++;
    else if (r.status === "late") lateCount++;
  }
  const totalAttendance = presentCount + absentCount + lateCount;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null;

  // Fetch gradebook row.
  let gradebook: Pick<GradebookRow, "percentage" | "assignment_earned_points" | "assignment_total_points" | "quiz_earned_points" | "quiz_total_points"> | null = null;
  const { data: gbRow } = await admin.from("class_gradebook")
    .select("percentage, assignment_earned_points, assignment_total_points, quiz_earned_points, quiz_total_points")
    .eq("student_id", studentId).maybeSingle();
  if (gbRow) {
    gradebook = gbRow as typeof gradebook;
  }

  // Generate the PDF.
  const pdfBytes = generateReportCardPDF({
    student: { id: student.id, full_name: student.full_name, role: student.role, class_id: student.class_id },
    school,
    className,
    attendanceRate,
    presentCount, absentCount, lateCount,
    gradebook,
  });

  // Return as a downloadable PDF.
  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-card-${student.full_name.replace(/[^a-z0-9]/gi, "_")}.pdf"`,
      "Content-Length": String(pdfBytes.byteLength),
    },
  });
}
