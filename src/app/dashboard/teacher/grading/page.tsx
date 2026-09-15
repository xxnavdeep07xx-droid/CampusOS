import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { GradingQueueClient } from "./grading-queue-client";
import type { Profile } from "@/lib/types";

/**
 * /dashboard/teacher/grading
 *
 * Unified inbox of every ungraded submission across the teacher's classes.
 * Teachers no longer need to drill class → assignment → expand just to find
 * what still needs grading.
 */
export const dynamic = "force-dynamic";

export default async function GradingQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/grading");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;

  if (profile?.role !== "teacher") {
    return (
      <div className="space-y-4">
        <Tag color="bg-rose-400">Access restricted</Tag>
        <p className="text-sm font-medium text-slate-700">
          The grading queue is only available to teachers.
        </p>
      </div>
    );
  }

  // Fetch the teacher's classes
  const { data: classesRaw } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  const classes = (classesRaw ?? []) as { id: string; name: string }[];
  const classIds = classes.map((c) => c.id);

  // Fetch all assignments for those classes
  let assignments: { id: string; title: string; class_id: string; due_date: string | null }[] = [];
  if (classIds.length > 0) {
    const { data: aRaw, error: aErr } = await supabase
      .from("assignments")
      .select("id, title, class_id, due_date")
      .in("class_id", classIds)
      .order("created_at", { ascending: false });
    if (!aErr && aRaw) assignments = aRaw as typeof assignments;
  }
  const assignmentIds = assignments.map((a) => a.id);

  // Fetch all ungraded submissions for those assignments
  let submissions: any[] = [];
  if (assignmentIds.length > 0) {
    const { data: sRaw, error: sErr } = await supabase
      .from("submissions")
      .select(`
        id,
        file_path,
        submitted_at,
        grade,
        feedback,
        status,
        assignment_id,
        student_id,
        student:profiles!submissions_student_id_fkey(id, full_name)
      `)
      .in("assignment_id", assignmentIds)
      .is("grade", null)
      .order("submitted_at", { ascending: false });
    if (!sErr && sRaw) submissions = sRaw as any[];
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-amber-300">Grading queue</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Pending Submissions
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Every submission awaiting a grade, across all your classes — sorted
          by most recent first. Grade them inline below.
        </p>
      </div>

      <GradingQueueClient
        submissions={submissions}
        assignments={assignments}
        classes={classes}
      />
    </div>
  );
}
