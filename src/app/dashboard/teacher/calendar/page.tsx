import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { CalendarClient, type CalendarEvent } from "./calendar-client";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/calendar
 *
 * Unified calendar view — aggregates every date-bound entity the teacher
 * cares about into one month grid:
 *   - Timetable slots (recurring weekly — surfaced on matching weekday)
 *   - Assignment due dates
 *   - Quiz due dates
 *   - Lesson plans (scheduled on specific dates)
 *   - Syllabus unit target dates
 *
 * Color coding:
 *   - Sky blue: timetable slot
 *   - Rose: assignment due
 *   - Violet: quiz due
 *   - Emerald: lesson plan
 *   - Amber: syllabus target date
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/calendar");

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
          The calendar is only available to teachers.
        </p>
      </div>
    );
  }

  // Determine the month to display. Default to current month.
  // Format: YYYY-MM (e.g. "2026-09")
  const sp = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthParam = sp.month ?? defaultMonth;

  // Parse + validate the month param.
  const [yearStr, monthStr] = monthParam.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    redirect("/dashboard/teacher/calendar");
  }

  // Compute the first + last day of the month, plus the SQL date range
  // (we expand by a few days on each side to catch events that span the
  // boundary when rendered on the calendar grid).
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0); // day 0 of next month = last day of this month
  const rangeStart = new Date(firstOfMonth);
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(lastOfMonth);
  rangeEnd.setDate(rangeEnd.getDate() + 7);
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);
  const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

  // Fetch the teacher's classes (for class names + timetable lookup).
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  const classes = (classRows ?? []) as { id: string; name: string }[];
  const classIds = classes.map((c) => c.id);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));

  // ===== Fetch all date-bound entities in parallel =====
  const events: CalendarEvent[] = [];

  // 1. Timetable slots (recurring weekly — we surface them on every
  //    matching weekday in the visible month).
  try {
    const { data: slots } = await supabase
      .from("timetables")
      .select("id, class_id, day, start_time, end_time, subject")
      .in("class_id", classIds.length > 0 ? classIds : ["__none__"]);
    if (slots) {
      // For each slot, find every matching weekday in the month and add an event.
      const DAY_TO_JS_DOW: Record<string, number> = {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      };
      for (const slot of slots as any[]) {
        const dow = DAY_TO_JS_DOW[String(slot.day).toLowerCase()];
        if (dow === undefined) continue;
        // Iterate every day in the visible month + boundary.
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
          if (d.getMonth() !== month - 1) continue; // skip out-of-month
          if (d.getDay() !== dow) continue;
          const dateStr = d.toISOString().slice(0, 10);
          events.push({
            id: `tt-${slot.id}-${dateStr}`,
            type: "timetable",
            date: dateStr,
            time: `${slot.start_time?.slice(0, 5) ?? ""}–${slot.end_time?.slice(0, 5) ?? ""}`,
            title: slot.subject || (classMap.get(slot.class_id) ?? "Class"),
            subtitle: classMap.get(slot.class_id) ?? undefined,
            linkUrl: `/dashboard/classes/${slot.class_id}`,
          });
        }
      }
    }
  } catch (err) {
    console.warn("timetable fetch error:", err);
  }

  // 2. Assignment due dates.
  try {
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, title, class_id, due_date")
      .in("class_id", classIds.length > 0 ? classIds : ["__none__"])
      .gte("due_date", rangeStartStr)
      .lte("due_date", rangeEndStr + "T23:59:59");
    if (assignments) {
      for (const a of assignments as any[]) {
        if (!a.due_date) continue;
        const dateStr = a.due_date.slice(0, 10);
        events.push({
          id: `assign-${a.id}`,
          type: "assignment",
          date: dateStr,
          time: a.due_date.slice(11, 16) || undefined,
          title: a.title,
          subtitle: classMap.get(a.class_id) ?? undefined,
          linkUrl: `/dashboard/classes/${a.class_id}`,
        });
      }
    }
  } catch (err) {
    console.warn("assignments fetch error:", err);
  }

  // 3. Quiz due dates.
  try {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, title, class_id, due_date")
      .in("class_id", classIds.length > 0 ? classIds : ["__none__"])
      .gte("due_date", rangeStartStr)
      .lte("due_date", rangeEndStr + "T23:59:59");
    if (quizzes) {
      for (const q of quizzes as any[]) {
        if (!q.due_date) continue;
        const dateStr = q.due_date.slice(0, 10);
        events.push({
          id: `quiz-${q.id}`,
          type: "quiz",
          date: dateStr,
          time: q.due_date.slice(11, 16) || undefined,
          title: q.title,
          subtitle: classMap.get(q.class_id) ?? undefined,
          linkUrl: `/dashboard/quizzes/${q.id}`,
        });
      }
    }
  } catch (err) {
    console.warn("quizzes fetch error:", err);
  }

  // 4. Lesson plans (scheduled on specific dates).
  try {
    const { data: lessons } = await supabase
      .from("lesson_plans")
      .select("id, title, class_id, lesson_date, status")
      .eq("teacher_id", user.id)
      .gte("lesson_date", rangeStartStr)
      .lte("lesson_date", rangeEndStr);
    if (lessons) {
      for (const l of lessons as any[]) {
        if (!l.lesson_date) continue;
        const dateStr = l.lesson_date.slice(0, 10);
        events.push({
          id: `lesson-${l.id}`,
          type: "lesson",
          date: dateStr,
          title: l.title,
          subtitle: classMap.get(l.class_id ?? "") ?? undefined,
          linkUrl: `/dashboard/teacher/lessons`,
        });
      }
    }
  } catch (err) {
    console.warn("lesson plans fetch error:", err);
  }

  // 5. Syllabus unit target dates.
  try {
    const { data: units } = await supabase
      .from("syllabus_units")
      .select("id, title, class_id, target_date, total_lessons, completed_lessons")
      .eq("teacher_id", user.id)
      .gte("target_date", rangeStartStr)
      .lte("target_date", rangeEndStr);
    if (units) {
      for (const u of units as any[]) {
        if (!u.target_date) continue;
        const dateStr = u.target_date.slice(0, 10);
        events.push({
          id: `unit-${u.id}`,
          type: "syllabus",
          date: dateStr,
          title: `${u.title} target`,
          subtitle: classMap.get(u.class_id ?? "") ?? undefined,
          linkUrl: `/dashboard/teacher/syllabus`,
        });
      }
    }
  } catch (err) {
    console.warn("syllabus fetch error:", err);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-sky-300">Calendar</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Your month at a glance
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Timetable slots, assignment due dates, quiz deadlines, lesson plans,
          and syllabus targets — all in one calendar.
        </p>
      </div>

      <CalendarClient
        events={events}
        year={year}
        month={month}
      />
    </div>
  );
}
