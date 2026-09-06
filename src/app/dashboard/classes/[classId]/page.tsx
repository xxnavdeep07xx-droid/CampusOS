import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherClassroomView } from "@/components/brutal/teacher-classroom-view";
import { StudentClassroomView } from "@/components/brutal/student-classroom-view";
import type { ClassRoom, Profile, Resource, Assignment } from "@/lib/types";

/**
 * Unified classroom detail page at /dashboard/classes/[classId].
 *
 * Both teachers and students land here — the server component fetches the
 * class row + caller's profile, then dispatches to the role-specific view
 * (TeacherClassroomView for teachers/staff/principals, StudentClassroomView
 * for students).
 *
 * The role-specific views are client components so they can re-fetch data
 * after mutations (upload resource, create assignment, submit homework).
 */
export default async function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile + class row in parallel.
  const [{ data: profileRow }, { data: classRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  if (!cls) notFound();

  // Authorization: caller must be in the same school as the class.
  if (!profile || profile.school_id !== cls.school_id) {
    notFound();
  }

  const role = profile.role;

  // ===== Teachers / staff / principals → teacher view =====
  if (role === "teacher" || role === "staff" || role === "principal") {
    const isTeacher = cls.teacher_id === user.id;
    const isSchoolAdmin = role === "principal" || role === "staff";
    if (!isTeacher && !isSchoolAdmin) notFound();

    // Fetch resources + assignments + enrolled students in parallel.
    // Errors here are common when the Phase 2 migration hasn't been applied
    // yet — we surface a banner instead of crashing.
    const [
      { data: resourceRows, error: resourcesErr },
      { data: assignmentRows, error: assignmentsErr },
      { data: studentRows },
    ] = await Promise.all([
      supabase
        .from("resources")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase
        .from("assignments")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, role, created_at")
        .eq("class_id", classId)
        .eq("role", "student")
        .order("full_name", { ascending: true }),
    ]);

    const migrationMissing =
      (!!resourcesErr && /Could not find the table/i.test(resourcesErr.message)) ||
      (!!assignmentsErr && /Could not find the table/i.test(assignmentsErr.message));

    return (
      <TeacherClassroomView
        cls={cls}
        profile={profile}
        isTeacher={isTeacher}
        isSchoolAdmin={isSchoolAdmin}
        initialResources={(resourceRows ?? []) as Resource[]}
        initialAssignments={(assignmentRows ?? []) as Assignment[]}
        initialStudents={(studentRows ?? []) as Pick<
          Profile,
          "id" | "full_name" | "created_at"
        >[]}
        migrationMissing={migrationMissing}
      />
    );
  }

  // ===== Students → student view =====
  if (role === "student") {
    if (profile.class_id !== classId) {
      // Student trying to view a class they're not enrolled in —
      // bounce to their My Classes page.
      redirect("/dashboard/classes");
    }

    // Fetch resources + assignments + this student's existing submissions.
    const [{ data: resourceRows }, { data: assignmentRows }, { data: submissionRows }] =
      await Promise.all([
        supabase
          .from("resources")
          .select("*")
          .eq("class_id", classId)
          .order("created_at", { ascending: false }),
        supabase
          .from("assignments")
          .select("*")
          .eq("class_id", classId)
          .order("created_at", { ascending: false }),
        supabase
          .from("submissions")
          .select("id, assignment_id, status, grade")
          .eq("student_id", user.id),
      ]);

    return (
      <StudentClassroomView
        cls={cls}
        profile={profile}
        initialResources={(resourceRows ?? []) as Resource[]}
        initialAssignments={(assignmentRows ?? []) as Assignment[]}
        initialSubmissions={(submissionRows ?? []) as Array<{
          id: string;
          assignment_id: string;
          status: "submitted" | "graded";
          grade: number | null;
        }>}
      />
    );
  }

  // Unknown role — fallback.
  notFound();
}
