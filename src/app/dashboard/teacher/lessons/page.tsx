import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { LessonPlansClient } from "./lesson-plans-client";
import type { Profile, LessonPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/lessons
 *
 * Lesson plans page — shows the current week + lets the teacher create,
 * edit, and delete lesson plans. Optionally link each plan to a syllabus
 * unit so its completion is auto-tracked.
 */
export default async function LessonPlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/lessons");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;

  if (profile?.role !== "teacher" && profile?.role !== "principal" && profile?.role !== "staff") {
    return (
      <div className="space-y-4">
        <Tag color="bg-rose-400">Access restricted</Tag>
        <p className="text-sm font-medium text-slate-700">
          Lesson plans are only available to teachers.
        </p>
      </div>
    );
  }

  // Fetch teacher's classes for the create modal.
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  const classes = (classRows ?? []) as { id: string; name: string }[];

  // Fetch syllabus units for linking.
  const { data: unitRows, error: unitErr } = await supabase
    .from("syllabus_units")
    .select("id, title, class_id")
    .eq("teacher_id", user.id)
    .order("position");
  const syllabusUnits = unitErr ? [] : (unitRows ?? []) as { id: string; title: string; class_id: string | null }[];

  // Fetch lesson plans for the next 30 days + past 7 days so the weekly
  // grid shows recent + upcoming context.
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const thirtyDaysAhead = new Date(today);
  thirtyDaysAhead.setDate(today.getDate() + 30);

  const { data: lessonRows, error: lessonErr } = await supabase
    .from("lesson_plans")
    .select("*, classes(id, name), syllabus_units(id, title)")
    .eq("teacher_id", user.id)
    .gte("lesson_date", sevenDaysAgo.toISOString().slice(0, 10))
    .lte("lesson_date", thirtyDaysAhead.toISOString().slice(0, 10))
    .order("lesson_date", { ascending: true });

  let lessons: LessonPlan[] = [];
  if (lessonErr && /Could not find the table|does not exist/i.test(lessonErr.message)) {
    lessons = [];
  } else if (!lessonErr && lessonRows) {
    lessons = lessonRows as LessonPlan[];
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-sky-300">Lesson plans</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Daily &amp; weekly plans
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Plan your lessons ahead of time. Optionally link each lesson to a
          syllabus unit so progress is auto-tracked. Click any day on the
          week grid below to add or view lessons.
        </p>
      </div>

      <LessonPlansClient
        initialLessons={lessons}
        classes={classes}
        syllabusUnits={syllabusUnits}
        migrationMissing={!!lessonErr && /Could not find the table|does not exist/i.test(lessonErr.message)}
      />
    </div>
  );
}
