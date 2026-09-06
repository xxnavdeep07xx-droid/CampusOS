import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { Card, CardContent } from "@/components/ui/card";
import { TeacherScheduleView } from "@/components/brutal/teacher-schedule-view";
import type { ClassRoom, Profile, Timetable } from "@/lib/types";

/**
 * Teacher schedule page at /dashboard/teacher/schedule.
 *
 * Server component. Fetches the teacher's classes + all timetable slots
 * across them, then renders a WeekGrid that lets the teacher add/delete
 * slots.
 */
export default async function TeacherSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;
  if (!profile) redirect("/login");

  // Anyone other than a teacher / staff / principal gets redirected.
  if (
    profile.role !== "teacher" &&
    profile.role !== "staff" &&
    profile.role !== "principal"
  ) {
    redirect("/dashboard");
  }

  // Fetch the caller's classes.
  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("school_id", profile.school_id ?? "");

  // Teachers see only their own classes. Principals/staff see all.
  if (profile.role === "teacher") {
    classQuery = classQuery.eq("teacher_id", user.id);
  }
  const { data: classRows, error: classErr } = await classQuery.order(
    "created_at",
    { ascending: false }
  );
  const classes = (classRows ?? []) as ClassRoom[];

  // Fetch timetable slots for all these classes in one query.
  let slots: Array<Timetable & { classes?: { name: string } | null }> = [];
  let migrationMissing = false;
  if (classes.length > 0) {
    const { data: slotRows, error: slotsErr } = await supabase
      .from("timetables")
      .select("*, classes(id, name)")
      .in(
        "class_id",
        classes.map((c) => c.id)
      )
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (slotsErr && /Could not find the table/i.test(slotsErr.message)) {
      migrationMissing = true;
    } else if (slotsErr) {
      // Other errors are surfaced by the client component.
      console.warn("timetable fetch error:", slotsErr.message);
    }
    slots = (slotRows ?? []) as Array<
      Timetable & { classes?: { name: string } | null }
    >;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-violet-300">Schedule</Tag>
          {profile.role !== "teacher" && (
            <Tag color="bg-amber-200">Read-only (school admin)</Tag>
          )}
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Weekly schedule
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Add recurring weekly class periods. Each slot is bound to one of your
          classes. Students see this schedule in their dashboard.
        </p>
      </div>

      {migrationMissing ? (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 3 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">timetables</code> table
              doesn&apos;t exist in your Supabase project yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0003_attendance_timetable.sql</code>
              {" "}via the Supabase SQL editor. See{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/README.md</code>.
            </p>
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-bold text-slate-900">
              You don&apos;t have any classes yet.
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {profile.role === "teacher"
                ? "Create a class from the teacher dashboard first."
                : "Teachers create classes — once they do, the schedule will populate here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <TeacherScheduleView
          initialSlots={slots}
          teacherClasses={classes.map((c) => ({ id: c.id, name: c.name }))}
          canEdit={profile.role === "teacher"}
          migrationMissing={migrationMissing}
        />
      )}
    </div>
  );
}
