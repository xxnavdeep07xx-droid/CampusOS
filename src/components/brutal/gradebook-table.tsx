"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { GradebookRow } from "@/lib/types";
import { gradeColor } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * GradebookTable — a neo-brutalist data table for the class gradebook.
 *
 * Columns:
 *   # | Student | Assignments (earned / total) | Quizzes (earned / total)
 *   | Total % | Grade badge
 *
 * Includes an "Export to CSV" button that downloads the current rows as
 * a CSV file (with the standard RFC 4180 quoting rules).
 */
export function GradebookTable({
  rows,
  className,
}: {
  rows: GradebookRow[];
  className?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);

  // At-risk = percentage below 50% (F grade) OR no grades yet (which is a
  // different kind of risk — missing data the teacher needs to address).
  const atRiskThreshold = 50;
  const atRiskCount = useMemo(
    () =>
      rows.filter(
        (r) => r.percentage == null || r.percentage < atRiskThreshold
      ).length,
    [rows]
  );

  const visibleRows = useMemo(() => {
    if (!showAtRiskOnly) return rows;
    return rows.filter(
      (r) => r.percentage == null || r.percentage < atRiskThreshold
    );
  }, [rows, showAtRiskOnly]);

  function exportCsv() {
    setExporting(true);
    try {
      const headers = [
        "Student Name",
        "Student ID",
        "Assignment Count",
        "Assignment Earned",
        "Assignment Total",
        "Quiz Count",
        "Quiz Earned",
        "Quiz Total",
        "Total Earned",
        "Total Possible",
        "Percentage",
      ];

      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        if (/[",\n]/.test(s)) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csvRows = [
        headers.map(escape).join(","),
        ...rows.map((r) =>
          [
            r.student_name,
            r.student_id,
            r.assignment_count,
            r.assignment_earned_points,
            r.assignment_total_points,
            r.quiz_count,
            r.quiz_earned_points,
            r.quiz_total_points,
            r.total_earned,
            r.total_possible,
            r.percentage == null ? "" : r.percentage,
          ]
            .map(escape)
            .join(",")
        ),
      ];
      const csv = csvRows.join("\n");

      // Download via Blob.
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(className ?? "class").replace(/[^a-z0-9-]/gi, "_")}_gradebook.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
        <p className="text-sm font-bold text-slate-700">
          No students enrolled yet
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Generate a student invite link to bring students into this class —
          then their grades will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {visibleRows.length} {visibleRows.length === 1 ? "student" : "students"}
            {showAtRiskOnly && ` (filtered from ${rows.length})`}
          </p>
          {atRiskCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAtRiskOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 border-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all ${
                showAtRiskOnly
                  ? "bg-rose-400 text-[#FDFBF7]"
                  : "bg-rose-100 text-rose-700 hover:bg-rose-200"
              }`}
            >
              <AlertTriangle className="size-3" strokeWidth={2.5} />
              {atRiskCount} at-risk
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="sky"
          size="sm"
          onClick={exportCsv}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export to CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="text-center">Assignments</TableHead>
            <TableHead className="text-center">Quizzes</TableHead>
            <TableHead className="text-center">Total Earned</TableHead>
            <TableHead className="text-center">%</TableHead>
            <TableHead className="text-center">Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row, i) => {
            const pct = row.percentage;
            const isAtRisk = pct == null || pct < atRiskThreshold;
            return (
              <TableRow key={row.student_id} className={isAtRisk && showAtRiskOnly ? "bg-rose-50" : ""}>
                <TableCell className="text-center text-xs font-bold text-slate-500">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                      {(row.student_name || "?").slice(0, 2)}
                    </div>
                    <span className="font-bold text-slate-900">
                      {row.student_name || "(no name)"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-xs font-bold">
                    <span className="text-emerald-700">{row.assignment_earned_points}</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-slate-700">{row.assignment_total_points}</span>
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {row.assignment_count} {row.assignment_count === 1 ? "graded" : "graded"}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-xs font-bold">
                    <span className="text-sky-700">{row.quiz_earned_points}</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-slate-700">{row.quiz_total_points}</span>
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {row.quiz_count} {row.quiz_count === 1 ? "quiz" : "quizzes"}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    <span className="text-emerald-700">{row.total_earned}</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-slate-700">{row.total_possible}</span>
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {pct == null ? (
                    <span className="text-xs font-bold text-slate-400">—</span>
                  ) : (
                    <span
                      className={cn(
                        "font-mono text-base font-black",
                        pct >= 90 ? "text-emerald-700"
                          : pct >= 75 ? "text-amber-700"
                          : pct >= 50 ? "text-sky-700"
                          : "text-rose-700"
                      )}
                    >
                      {pct}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {pct == null ? (
                    <Badge variant="outline">No grades yet</Badge>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
                        gradeColor(pct)
                      )}
                    >
                      {pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
