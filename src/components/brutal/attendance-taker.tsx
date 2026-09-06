"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Save,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusToggleGroup, StatusBadge } from "@/components/brutal/status-toggle";
import { InlineSpinner } from "@/components/brutal/skeleton";
import type { AttendanceStatus, Profile } from "@/lib/types";
import { toDateInputValue } from "@/lib/types";

/**
 * AttendanceTaker — the client component that powers the attendance page.
 *
 * Props (passed from the server component):
 *   - classId, className
 *   - students: enrolled students (id + full_name only)
 *   - initialDate: today's date (YYYY-MM-DD)
 *   - initialRecords: attendance rows already saved for this date
 *
 * Behavior:
 *   - Loads existing attendance for the date (or uses initialRecords).
 *   - For each student, a StatusToggleGroup lets the teacher mark them
 *     Present / Absent / Late.
 *   - "Save Attendance" batch-upserts via POST /api/attendance.
 *   - Date picker lets the teacher navigate to past/future dates — switching
 *     date re-fetches via /api/attendance?classId=...&date=...
 */
export function AttendanceTaker({
  classId,
  className,
  students,
  initialDate,
  initialRecords,
}: {
  classId: string;
  className: string;
  students: Pick<Profile, "id" | "full_name">[];
  initialDate: string;
  initialRecords: Array<{ id: string; student_id: string; status: AttendanceStatus }>;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(() => {
    // Build a { studentId → status } map from initialRecords.
    const m: Record<string, AttendanceStatus> = {};
    for (const r of initialRecords) m[r.student_id] = r.status;
    return m;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const today = toDateInputValue(new Date());

  // Fetch records when the date changes.
  const fetchForDate = useCallback(
    async (d: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/attendance?classId=${classId}&date=${d}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
        const m: Record<string, AttendanceStatus> = {};
        for (const r of (json.records ?? []) as Array<{
          student_id: string;
          status: AttendanceStatus;
        }>) {
          m[r.student_id] = r.status;
        }
        setRecords(m);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [classId]
  );

  useEffect(() => {
    if (date === initialDate) return; // already loaded by server component
    fetchForDate(date);
  }, [date, initialDate, fetchForDate]);

  function handleStatusChange(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  }

  function shiftDate(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(toDateInputValue(d));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const recordsToSave = students
        .filter((s) => records[s.id]) // only save students with a chosen status
        .map((s) => ({
          studentId: s.id,
          status: records[s.id] as AttendanceStatus,
        }));

      if (recordsToSave.length === 0) {
        setError("Mark at least one student before saving.");
        return;
      }

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          date,
          records: recordsToSave,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Summary stats for the current state.
  const summary = useMemo(() => {
    let present = 0,
      absent = 0,
      late = 0,
      unmarked = 0;
    for (const s of students) {
      const st = records[s.id];
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "late") late++;
      else unmarked++;
    }
    return { present, absent, late, unmarked };
  }, [records, students]);

  const isToday = date === today;

  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftDate(-1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-44 pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftDate(1)}
              disabled={date >= today}
              aria-label="Next day"
            >
              <ChevronRight className="size-4" />
            </Button>
            {!isToday && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDate(today)}
              >
                Jump to today
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="emerald">{summary.present} present</Badge>
            <Badge variant="coral">{summary.absent} absent</Badge>
            <Badge variant="amber">{summary.late} late</Badge>
            {summary.unmarked > 0 && (
              <Badge variant="outline">{summary.unmarked} unmarked</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Students list */}
      {loading ? (
        <InlineSpinner label="Loading attendance…" />
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Inbox className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No students enrolled in this class yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Generate a student invite link from the teacher dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-[#FDFBF7]">
            <div className="flex items-center gap-2">
              <Users className="size-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                {students.length} {students.length === 1 ? "student" : "students"}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {className}
            </span>
          </div>

          <div className="divide-y-2 divide-slate-200">
            {students.map((s, i) => {
              const status = records[s.id] ?? null;
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      {(s.full_name || "?").slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {s.full_name || "(no name)"}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Roll #{i + 1}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {status && (
                      <StatusBadge status={status} className="md:hidden" />
                    )}
                    <StatusToggleGroup
                      value={status}
                      onChange={(next) => handleStatusChange(s.id, next)}
                      disabled={saving}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save bar */}
      {students.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            <AlertCircle className="size-4" />
            Changes are saved only when you press Save.
          </div>
          <div className="flex items-center gap-2">
            {savedFlash && (
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-900 bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <CheckCircle2 className="size-4" />
                Saved!
              </span>
            )}
            <Button
              type="button"
              variant="emerald"
              onClick={handleSave}
              disabled={saving || summary.unmarked === students.length}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save attendance
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
        >
          <AlertCircle className="mr-2 inline size-4" />
          {error}
        </div>
      )}
    </div>
  );
}
