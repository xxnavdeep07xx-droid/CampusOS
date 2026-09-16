import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { SyllabusTrackerClient } from "./syllabus-tracker-client";
import type { Profile, SyllabusUnit } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/syllabus
 *
 * Syllabus tracker — teachers see their units with progress bars showing
 * completed/total lessons. Supports filtering by class + creating new units.
 */
export default async function SyllabusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/syllabus");

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
          The syllabus tracker is only available to teachers.
        </p>
      </div>
    );
  }

  // Fetch teacher's classes (for the class filter + new unit dropdown).
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  const classes = (classRows ?? []) as { id: string; name: string }[];

  // Fetch all syllabus units for this teacher.
  const { data: unitRows, error } = await supabase
    .from("syllabus_units")
    .select("*, classes(id, name)")
    .eq("teacher_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  let units: SyllabusUnit[] = [];
  if (error && /Could not find the table|does not exist/i.test(error.message)) {
    units = [];
  } else if (!error && unitRows) {
    units = unitRows as SyllabusUnit[];
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-emerald-300">Syllabus tracker</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Syllabus progress
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Track how far you are through each syllabus unit. Update the
          completed-lessons count as you cover material — the progress bar
          auto-updates and the status reflects where you are.
        </p>
      </div>

      <SyllabusTrackerClient
        initialUnits={units}
        classes={classes}
        migrationMissing={!!error && /Could not find the table|does not exist/i.test(error.message)}
      />
    </div>
  );
}
