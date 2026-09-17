import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { BehaviorDashboardClient } from "./behavior-dashboard-client";
import type { Profile, BehaviorIncident } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/behavior
 *
 * Class-wide behavior dashboard — shows ALL behavior incidents across the
 * teacher's classes in one view (the Student 360° profile only shows
 * per-student incidents).
 *
 * Features:
 *   - Summary stat cards (total / positive / concern / neutral)
 *   - Filter by class + severity
 *   - Sortable incident list with student name, class, severity, category,
 *     date, and deep-link to the student's profile
 *   - Realtime updates (new incidents appear instantly)
 */
export default async function BehaviorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/behavior");

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
          The behavior dashboard is only available to teachers.
        </p>
      </div>
    );
  }

  // Fetch the teacher's classes for the class filter.
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  const classes = (classRows ?? []) as { id: string; name: string }[];
  const classIds = classes.map((c) => c.id);

  // Fetch all incidents for the teacher's classes (most recent 100).
  // We fetch via the admin client to bypass RLS — the teacher can see
  // incidents for any student in their classes, including those logged
  // by school admins.
  let incidents: any[] = [];
  let migrationMissing = false;
  try {
    const { data: iRows, error: iErr } = await supabase
      .from("behavior_incidents")
      .select(`
        *,
        student:profiles!behavior_incidents_student_id_fkey(id, full_name),
        recorder:profiles!behavior_incidents_recorded_by_fkey(id, full_name),
        classes(id, name)
      `)
      .in("class_id", classIds.length > 0 ? classIds : ["__none__"])
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (iErr && /Could not find the table|does not exist/i.test(iErr.message)) {
      migrationMissing = true;
    } else if (!iErr && iRows) {
      incidents = iRows as any[];
    }
  } catch (err) {
    console.warn("incidents fetch error:", err);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-rose-300">Behavior</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Class behavior log
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Every behavior incident across all your classes — disciplinary issues,
          positive milestones, and informational notes. Click any student to
          see their full 360° profile.
        </p>
      </div>

      <BehaviorDashboardClient
        initialIncidents={incidents}
        classes={classes}
        migrationMissing={migrationMissing}
      />
    </div>
  );
}
