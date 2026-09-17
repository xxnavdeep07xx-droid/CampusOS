"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  CalendarFold,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type CalendarEventType = "timetable" | "assignment" | "quiz" | "lesson" | "syllabus";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  date: string; // YYYY-MM-DD
  time?: string; // "HH:MM" or "HH:MM–HH:MM"
  title: string;
  subtitle?: string;
  linkUrl?: string;
}

const TYPE_META: Record<CalendarEventType, { label: string; chipClass: string; icon: React.ReactNode }> = {
  timetable: {
    label: "Timetable",
    chipClass: "bg-sky-100 text-sky-900 border-sky-300",
    icon: <Clock className="size-3" />,
  },
  assignment: {
    label: "Assignment",
    chipClass: "bg-rose-100 text-rose-900 border-rose-300",
    icon: <BookOpen className="size-3" />,
  },
  quiz: {
    label: "Quiz",
    chipClass: "bg-violet-100 text-violet-900 border-violet-300",
    icon: <HelpCircle className="size-3" />,
  },
  lesson: {
    label: "Lesson",
    chipClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    icon: <BookOpen className="size-3" />,
  },
  syllabus: {
    label: "Syllabus",
    chipClass: "bg-amber-100 text-amber-900 border-amber-300",
    icon: <TrendingUp className="size-3" />,
  },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * CalendarClient
 *
 * Month grid calendar. Each cell shows up to 3 event chips (with "more"
 * indicator). Clicking a day opens a detail panel below the grid listing
 * all events for that day.
 */
export function CalendarClient({
  events,
  year,
  month,
}: {
  events: CalendarEvent[];
  year: number;
  month: number; // 1-12
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group events by date.
  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    // Sort each day's events by time (timetable slots first, then by time string).
    for (const [date, dayEvents] of m.entries()) {
      dayEvents.sort((a, b) => {
        // Timetable events first (recurring)
        if (a.type === "timetable" && b.type !== "timetable") return -1;
        if (b.type === "timetable" && a.type !== "timetable") return 1;
        return (a.time ?? "").localeCompare(b.time ?? "");
      });
    }
    return m;
  }, [events]);

  // Build the calendar grid (6 weeks × 7 days = 42 cells).
  // Start from the Monday on or before the 1st of the month.
  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(year, month - 1, 1);
    const firstDayJs = firstOfMonth.getDay(); // 0=Sun, 1=Mon, ...
    const offset = firstDayJs === 0 ? 6 : firstDayJs - 1; // shift so Monday is column 0
    const start = new Date(year, month - 1, 1 - offset);
    const days: { date: Date; dateStr: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push({
        date: d,
        dateStr: `${yyyy}-${mm}-${dd}`,
        inMonth: d.getMonth() === month - 1,
      });
    }
    return days;
  }, [year, month]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  // Navigate to prev/next month via URL (so it's shareable + bookmarkable).
  function navigateMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const monthStr = `${y}-${String(m).padStart(2, "0")}`;
    router.push(`/dashboard/teacher/calendar?month=${monthStr}`);
  }

  function jumpToToday() {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/dashboard/teacher/calendar?month=${monthStr}`);
  }

  const isCurrentMonth = (() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() + 1 === month;
  })();

  // Stats for the legend bar.
  const typeCounts = useMemo(() => {
    const counts: Record<CalendarEventType, number> = {
      timetable: 0, assignment: 0, quiz: 0, lesson: 0, syllabus: 0,
    };
    for (const e of events) {
      if (e.type in counts) counts[e.type]++;
    }
    return counts;
  }, [events]);

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Toolbar — month nav + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => navigateMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[180px] text-center text-base font-black uppercase tracking-tight text-slate-900">
            {monthLabel}
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => navigateMonth(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentMonth && (
            <Button type="button" variant="ghost" size="sm" onClick={jumpToToday}>
              Today
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(TYPE_META) as CalendarEventType[]).map((t) => {
            const meta = TYPE_META[t];
            const count = typeCounts[t];
            if (count === 0) return null;
            return (
              <span
                key={t}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  meta.chipClass
                )}
              >
                {meta.icon}
                {meta.label}
                <span className="ml-0.5 rounded-full bg-white/60 px-1">{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Calendar grid */}
        <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b-2 border-slate-900 bg-slate-900 text-[#FDFBF7]">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {gridDays.map((day, i) => {
              const dayEvents = eventsByDate.get(day.dateStr) ?? [];
              const isToday = day.dateStr === todayStr;
              const isSelected = day.dateStr === selectedDate;
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(day.dateStr === selectedDate ? null : day.dateStr)}
                  className={cn(
                    "min-h-[88px] border-b-[1px] border-r-[1px] border-slate-200 p-1.5 text-left align-top transition-all hover:bg-amber-50",
                    !day.inMonth && "bg-slate-50 opacity-50",
                    isSelected && "bg-amber-100 ring-2 ring-inset ring-amber-500",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-[10px] font-black",
                        isToday
                          ? "bg-emerald-500 text-[#FDFBF7]"
                          : day.inMonth
                          ? "text-slate-700"
                          : "text-slate-400"
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] font-bold text-slate-500">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                  {/* Event chips (up to 3) */}
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const meta = TYPE_META[e.type];
                      return (
                        <div
                          key={e.id}
                          className={cn(
                            "truncate rounded border px-1 py-0.5 text-[9px] font-bold",
                            meta.chipClass
                          )}
                          title={`${meta.label}: ${e.title}${e.time ? ` (${e.time})` : ""}`}
                        >
                          {e.time && <span className="mr-1 opacity-70">{e.time.slice(0, 5)}</span>}
                          {e.title}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel — selected day's events */}
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="border-b-2 border-slate-900 bg-slate-900 px-3 py-2 text-[#FDFBF7]">
              <div className="flex items-center gap-2">
                <CalendarFold className="size-4" />
                <span className="text-xs font-black uppercase tracking-wider">
                  {selectedDate ? formatDateLabel(selectedDate) : "Select a day"}
                </span>
              </div>
            </div>
            <CardContent className="p-3">
              {!selectedDate ? (
                <p className="py-6 text-center text-xs font-medium text-slate-500">
                  Click any day on the calendar to see its events here.
                </p>
              ) : selectedEvents.length === 0 ? (
                <p className="py-6 text-center text-xs font-medium text-slate-500">
                  No events on this day.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedEvents.map((e) => {
                    const meta = TYPE_META[e.type];
                    return (
                      <li key={e.id}>
                        {e.linkUrl ? (
                          <Link
                            href={e.linkUrl}
                            className={cn(
                              "block rounded-lg border px-2.5 py-1.5 transition-all hover:translate-x-[-1px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
                              meta.chipClass
                            )}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                              {meta.icon}
                              {meta.label}
                              {e.time && <span>· {e.time}</span>}
                            </div>
                            <div className="mt-0.5 truncate text-xs font-bold">{e.title}</div>
                            {e.subtitle && (
                              <div className="truncate text-[10px] font-medium opacity-80">
                                {e.subtitle}
                              </div>
                            )}
                          </Link>
                        ) : (
                          <div className={cn("rounded-lg border px-2.5 py-1.5", meta.chipClass)}>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                              {meta.icon}
                              {meta.label}
                              {e.time && <span>· {e.time}</span>}
                            </div>
                            <div className="mt-0.5 truncate text-xs font-bold">{e.title}</div>
                            {e.subtitle && (
                              <div className="truncate text-[10px] font-medium opacity-80">
                                {e.subtitle}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Event types
              </div>
              <ul className="space-y-1.5">
                {(Object.keys(TYPE_META) as CalendarEventType[]).map((t) => {
                  const meta = TYPE_META[t];
                  return (
                    <li key={t} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-5 shrink-0 items-center justify-center rounded border",
                          meta.chipClass
                        )}
                      >
                        {meta.icon}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{meta.label}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
