"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Profile, GradebookRow } from "@/lib/types";
import { gradeColor } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * ReportCardsTable — a table of all enrolled students with their
 * attendance % + gradebook % + a "Generate PDF" button.
 *
 * Clicking Generate PDF:
 *   1. Sets the loading state for that row.
 *   2. Fetches GET /api/report-card/[studentId] which returns a PDF blob.
 *   3. Triggers a browser download of the PDF.
 *   4. Clears the loading state.
 */
export function ReportCardsTable({
  students,
  gradebookByStudent,
}: {
  students: Array<Pick<Profile, "id" | "full_name"> & {
    attendanceRate?: number | null;
  }>;
  gradebookByStudent: Record<string, Pick<GradebookRow, "percentage"> | null>;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleGeneratePDF(studentId: string, studentName: string) {
    setDownloading(studentId);
    try {
      const res = await fetch(`/api/report-card/${studentId}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-card-${studentName.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(null);
    }
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
        <p className="text-sm font-bold text-slate-700">No students enrolled</p>
        <p className="mt-1 text-xs font-medium text-slate-500">Generate student invites to see report cards here.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Student</TableHead>
          <TableHead className="text-center">Attendance</TableHead>
          <TableHead className="text-center">Gradebook %</TableHead>
          <TableHead className="text-center">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s, i) => {
          const gb = gradebookByStudent[s.id];
          const pct = gb?.percentage ?? null;
          return (
            <TableRow key={s.id}>
              <TableCell className="text-center text-xs font-bold text-slate-500">{i + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                    {(s.full_name || "?").slice(0, 2)}
                  </div>
                  <span className="font-bold text-slate-900">{s.full_name || "(no name)"}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                {s.attendanceRate == null ? (
                  <span className="text-xs font-bold text-slate-400">—</span>
                ) : (
                  <span className={cn("font-mono text-sm font-black", s.attendanceRate >= 90 ? "text-emerald-700" : s.attendanceRate >= 75 ? "text-amber-700" : "text-rose-700")}>
                    {s.attendanceRate}%
                  </span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {pct == null ? (
                  <Badge variant="outline">No grades</Badge>
                ) : (
                  <span className={cn("inline-flex items-center rounded-full border-2 border-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]", gradeColor(pct))}>
                    {pct}%
                  </span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  type="button"
                  variant="violet"
                  size="sm"
                  onClick={() => handleGeneratePDF(s.id, s.full_name)}
                  disabled={downloading === s.id}
                >
                  {downloading === s.id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <FileDown className="size-4" />
                      Generate PDF
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
