import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import { WeekGrid } from "@/components/brutal/week-grid";
import type { ClassRoom, Profile, Timetable } from "@/lib/types";

/**
 * Student schedule page at /dashboard/schedule.
 *
 * Server component. Fetches the student's class + that class's timetables,
 * then renders a read-only WeekGrid.
 */
export default async function StudentSchedulePage() {
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

  // Allow teachers + principals/staff to peek (read-only) too.
  if (
    profile.role !== "student" &&
    profile.role !== "teacher" &&
    profile.role !== "principal" &&
    profile.role !== "staff"
  ) {
    redirect("/dashboard");
  }

  let cls: ClassRoom | null = null;
  let slots: Array<Timetable & { classes?: { name: string } | null }> = [];
  let migrationMissing = false;

  if (profile.role === "student") {
    if (!profile.class_id) {
      // Student without a class — show empty state.
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Tag color="bg-violet-300">
              <CalendarDays className="size-3.5" />
              My schedule
            </Tag>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
              Weekly schedule
            </h1>
          </div>
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <Inbox className="size-6 text-slate-900" />
              </div>
              <p className="text-sm font-bold text-slate-900">
                You&apos;re not enrolled in a class yet
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Ask your teacher to send you a fresh student invite link.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const { data: classRow } = await supabase
      .from("classes")
      .select("*")
      .eq("id", profile.class_id)
      .single();
    cls = classRow as ClassRoom | null;

    const { data: slotRows, error: slotsErr } = await supabase
      .from("timetables")
      .select("*, classes(id, name)")
      .eq("class_id", profile.class_id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (slotsErr && /Could not find the table/i.test(slotsErr.message)) {
      migrationMissing = true;
    } else if (slotsErr) {
      console.warn("timetable fetch error:", slotsErr.message);
    }
    slots = (slotRows ?? []) as Array<
      Timetable & { classes?: { name: string } | null }
    >;
  } else {
    // Teachers / principals / staff see the teacher schedule route instead.
    redirect("/dashboard/teacher/schedule");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-violet-300">
            <CalendarDays className="size-3.5" />
            My schedule
          </Tag>
          {cls && <Tag color="bg-sky-300">{cls.name}</Tag>}
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Weekly schedule
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {slots.length} {slots.length === 1 ? "period" : "periods"} per week.
          Contact your teacher if anything looks off.
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
              doesn&apos;t exist yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Ask your teacher / principal to apply{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0003_attendance_timetable.sql</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <WeekGrid slots={slots} canEdit={false} />
      )}

      <p className="text-center text-xs font-medium text-slate-500">
        Want to see your attendance?{" "}
        <Link
          href="/dashboard/attendance"
          className="font-bold text-emerald-700 underline-offset-4 hover:underline"
        >
          View attendance
          <ArrowRight className="inline size-3" />
        </Link>
      </p>
    </div>
  );
}
