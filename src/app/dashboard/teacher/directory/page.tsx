import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { StaffDirectoryClient } from "./staff-directory-client";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/directory
 *
 * Read-only staff + parents directory. Lets teachers find and message other
 * staff members (teachers, admins) in their school, and parents of students
 * in their classes.
 *
 * Two lists:
 *   1. School staff (teachers, principals, staff) — same school as caller.
 *   2. Parents of students in the caller's classes (teachers only).
 *
 * Each row has a "Message" button that deep-links to /dashboard/teacher/messages?peer=USER_ID
 */
export default async function DirectoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/directory");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;
  if (!profile?.school_id) {
    return (
      <div className="space-y-4">
        <Tag color="bg-amber-200">Not configured</Tag>
        <p className="text-sm font-medium text-slate-700">
          Your account isn&apos;t linked to a school yet.
        </p>
      </div>
    );
  }

  // ===== 1. Fetch all staff in the school =====
  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name, role, school_id, created_at")
    .eq("school_id", profile.school_id)
    .in("role", ["teacher", "principal", "staff"])
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  const allStaff = (staffRows ?? []) as Pick<
    Profile,
    "id" | "full_name" | "role" | "school_id" | "created_at"
  >[];

  // For teachers, also include class counts.
  let staffWithClassCount: any[] = [];
  if (profile.role === "teacher" || profile.role === "principal" || profile.role === "staff") {
    const teacherIds = allStaff.filter((s) => s.role === "teacher").map((s) => s.id);
    if (teacherIds.length > 0) {
      const { data: clsRows } = await supabase
        .from("classes")
        .select("id, teacher_id")
        .in("teacher_id", teacherIds);
      const clsByTeacher: Record<string, number> = {};
      for (const c of (clsRows ?? []) as { id: string; teacher_id: string }[]) {
        clsByTeacher[c.teacher_id] = (clsByTeacher[c.teacher_id] ?? 0) + 1;
      }
      staffWithClassCount = allStaff.map((s) => ({
        ...s,
        class_count: s.role === "teacher" ? clsByTeacher[s.id] ?? 0 : null,
      }));
    } else {
      staffWithClassCount = allStaff.map((s) => ({ ...s, class_count: null }));
    }
  }

  // ===== 2. Fetch parents of students in the caller's classes (teachers only) =====
  let parents: any[] = [];
  if (profile.role === "teacher") {
    // Fetch the caller's classes + their students.
    const { data: classRows } = await supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", user.id);
    const classes = (classRows ?? []) as { id: string; name: string }[];

    if (classes.length > 0) {
      const classIds = classes.map((c) => c.id);
      const { data: studentRows } = await supabase
        .from("profiles")
        .select("id, full_name, class_id")
        .in("class_id", classIds)
        .eq("role", "student");
      const studentIds = (studentRows ?? []).map((s) => (s as any).id);

      if (studentIds.length > 0) {
        // Fetch parent_student_links → join with parent profiles.
        const { data: linkRows } = await supabase
          .from("parent_student_links")
          .select(`
            parent_id,
            student_id,
            parent:profiles!parent_student_links_parent_id_fkey(id, full_name),
            student:profiles!parent_student_links_student_id_fkey(id, full_name, class_id)
          `)
          .in("student_id", studentIds);

        // Build a unique parent list with their student(s) info.
        const parentsMap = new Map<string, { id: string; full_name: string; students: { id: string; full_name: string; class_id: string }[] }>();
        for (const link of (linkRows ?? []) as any[]) {
          const parent = link.parent;
          const student = link.student;
          if (!parent?.id) continue;
          if (!parentsMap.has(parent.id)) {
            parentsMap.set(parent.id, {
              id: parent.id,
              full_name: parent.full_name ?? "(no name)",
              students: [],
            });
          }
          const entry = parentsMap.get(parent.id)!;
          if (student?.id) {
            entry.students.push({
              id: student.id,
              full_name: student.full_name ?? "(no name)",
              class_id: student.class_id,
            });
          }
        }

        // Enrich with class names for each parent's students.
        parents = Array.from(parentsMap.values()).map((p) => ({
          ...p,
          students: p.students.map((s) => ({
            ...s,
            class_name: classes.find((c) => c.id === s.class_id)?.name ?? "—",
          })),
        }));
        parents.sort((a, b) => a.full_name.localeCompare(b.full_name));
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-emerald-300">Directory</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Staff &amp; parents
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Find other staff at your school and parents of your students. Click
          &ldquo;Message&rdquo; on anyone to start a direct conversation.
        </p>
      </div>

      <StaffDirectoryClient
        staff={staffWithClassCount}
        parents={parents}
        currentUserId={user.id}
      />
    </div>
  );
}
