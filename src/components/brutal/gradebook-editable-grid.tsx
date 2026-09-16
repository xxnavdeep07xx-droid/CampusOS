"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Loader2, PencilRuler, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/brutal/section";
import { formatDate } from "@/lib/storage";

/**
 * GradebookEditableGrid
 *
 * A spreadsheet-like grid where rows = students and columns = assignments.
 * Each cell is an inline-editable grade input (0–100).
 *
 * Behavior:
 *   - If a submission exists for (student, assignment): the cell shows the
 *     current grade and is editable. On blur or Enter, PATCHes
 *     /api/submissions/[id] with the new grade.
 *   - If no submission exists: the cell shows "—" and is disabled (you
 *     can't grade a submission that doesn't exist — the student needs to
 *     upload their work first).
 *   - Cells flash green briefly when a save succeeds.
 *   - Cells flash red when a save fails, and the input reverts.
 *
 * The grid is horizontally scrollable when there are many assignments.
 */
type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  grade: number | null;
};

type Assignment = {
  id: string;
  title: string;
  due_date: string | null;
};

type Student = {
  id: string;
  full_name: string;
};

export function GradebookEditableGrid({
  classId: _classId,
  assignments,
  students,
  initialSubmissions,
}: {
  classId: string;
  assignments: Assignment[];
  students: Student[];
  initialSubmissions: Submission[];
}) {
  // Build a lookup map: { `${studentId}:${assignmentId}` → submission }
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<Set<string>>(new Set());
  const [errorCell, setErrorCell] = useState<string | null>(null);

  const submissionMap = useMemo(() => {
    const m = new Map<string, Submission>();
    for (const s of submissions) {
      m.set(`${s.student_id}:${s.assignment_id}`, s);
    }
    return m;
  }, [submissions]);

  const handleSave = useCallback(
    async (studentId: string, assignmentId: string, gradeValue: number | null) => {
      const key = `${studentId}:${assignmentId}`;
      const submission = submissionMap.get(key);
      if (!submission) return; // can't save without a submission row

      // Skip if unchanged
      if (gradeValue === submission.grade) return;

      setSavingCell(key);
      setErrorCell(null);
      try {
        const res = await fetch(`/api/submissions/${submission.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grade: gradeValue }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Failed (HTTP ${res.status})`);
        }
        // Update local state
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submission.id
              ? { ...s, grade: gradeValue, status: gradeValue !== null ? "graded" : "submitted" }
              : s
          )
        );
        // Flash green
        setSavedFlash((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setSavedFlash((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 1500);
      } catch (err) {
        setErrorCell(key);
        // Revert will happen naturally because we don't update submissions state
        console.error("Grade save failed:", err);
      } finally {
        setSavingCell(null);
      }
    },
    [submissionMap]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <PencilRuler className="size-4" />
            Assignment grades
          </h2>
          <p className="text-xs font-medium text-slate-600">
            Enter grades directly in the cells below. Press Tab/Enter or click
            away to save. Cells show &ldquo;—&rdquo; when a student hasn&apos;t
            submitted yet.
          </p>
        </div>
      </div>

      {errorCell && (
        <div className="rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          Failed to save grade for one cell. The value has been reverted — try again.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-[#FDFBF7]">
              <th className="sticky left-0 z-10 min-w-[160px] border-r-2 border-slate-700 bg-slate-900 px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">
                Student
              </th>
              {assignments.map((a) => (
                <th
                  key={a.id}
                  className="min-w-[100px] border-r-2 border-slate-700 px-2 py-2 text-center"
                >
                  <div className="truncate text-[10px] font-bold uppercase tracking-wider" title={a.title}>
                    {a.title}
                  </div>
                  {a.due_date && (
                    <div className="text-[9px] font-medium text-slate-400">
                      {formatDate(a.due_date)}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, rowIdx) => (
              <tr
                key={student.id}
                className={cn(rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50")}
              >
                <td className="sticky left-0 z-10 min-w-[160px] border-r-2 border-slate-200 bg-inherit px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded border-2 border-slate-900 bg-amber-200 text-[10px] font-black uppercase text-slate-900">
                      {(student.full_name || "?").slice(0, 2)}
                    </div>
                    <span className="truncate text-xs font-bold text-slate-900">
                      {student.full_name || "(no name)"}
                    </span>
                  </div>
                </td>
                {assignments.map((assignment) => {
                  const key = `${student.id}:${assignment.id}`;
                  const submission = submissionMap.get(key);
                  const isSaving = savingCell === key;
                  const isFlashing = savedFlash.has(key);
                  return (
                    <td
                      key={assignment.id}
                      className={cn(
                        "border-r-2 border-slate-200 px-1 py-1 text-center",
                        isFlashing && "bg-emerald-100"
                      )}
                    >
                      {submission ? (
                        <GradeCell
                          submissionId={submission.id}
                          initialValue={submission.grade}
                          isSaving={isSaving}
                          onSave={(grade) => handleSave(student.id, assignment.id, grade)}
                        />
                      ) : (
                        <span className="text-xs text-slate-300" title="No submission yet">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] font-medium text-slate-500">
        Tip: grades auto-save when you press Enter, Tab, or click away from a
        cell. To clear a grade, delete the number and press Enter.
      </p>
    </div>
  );
}

/**
 * GradeCell — a single editable grade input.
 *
 * Local state tracks the input value. On blur or Enter, calls onSave with
 * the parsed number (or null if empty). Re-syncs with `initialValue` when
 * the prop changes (e.g. after an external refresh).
 */
function GradeCell({
  submissionId,
  initialValue,
  isSaving,
  onSave,
}: {
  submissionId: string;
  initialValue: number | null;
  isSaving: boolean;
  onSave: (grade: number | null) => void;
}) {
  const [value, setValue] = useState(initialValue?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync when initialValue changes externally.
  // (We compare against the string form to avoid unnecessary re-renders.)
  const externalStr = initialValue?.toString() ?? "";
  if (!dirty && value !== externalStr) {
    setValue(externalStr);
  }

  function commit() {
    if (!dirty) return;
    const trimmed = value.trim();
    if (trimmed === "") {
      onSave(null);
    } else {
      const n = Number(trimmed);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) {
        onSave(n);
      } else {
        // Invalid — revert
        setValue(externalStr);
      }
    }
    setDirty(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      // Move focus to next input in the same row (if any)
      const form = e.currentTarget.form;
      if (form) {
        const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input[data-cell]"));
        const idx = inputs.indexOf(e.currentTarget);
        if (idx >= 0 && idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
      }
    } else if (e.key === "Tab") {
      // Let the browser handle Tab, but commit first
      commit();
    } else if (e.key === "Escape") {
      // Revert
      setValue(externalStr);
      setDirty(false);
      inputRef.current?.blur();
    }
  }

  const gradeColor =
    initialValue == null
      ? "text-slate-400"
      : initialValue >= 90
      ? "text-emerald-700"
      : initialValue >= 70
      ? "text-sky-700"
      : initialValue >= 50
      ? "text-amber-700"
      : "text-rose-700";

  return (
    <div className="relative flex items-center justify-center">
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={100}
        step={1}
        data-cell
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        placeholder="—"
        className={cn(
          "h-8 w-16 rounded border-2 border-slate-200 bg-white text-center text-sm font-black tabular-nums focus:border-slate-900 focus:outline-none",
          gradeColor,
          isSaving && "opacity-50"
        )}
      />
      {isSaving && (
        <Loader2 className="absolute right-1 top-1/2 size-3 -translate-y-1/2 animate-spin text-slate-400" />
      )}
      {!isSaving && dirty && (
        <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-amber-400" title="Unsaved" />
      )}
    </div>
  );
}
