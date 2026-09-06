"use client";

import { useState } from "react";
import { Check, File as FileIcon, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Submission, Profile } from "@/lib/types";
import { fileColorFor, fileColorBgClass, fileColorLabel } from "@/lib/types";
import { formatDateTime } from "@/lib/storage";

/**
 * SubmissionCard — used in the teacher's "Grade Submissions" view.
 *
 * Shows the student's name, submission file (with download button), the
 * current grade (if graded), and an inline grade input + save button.
 *
 * Props:
 *   - submission: the Submission row.
 *   - student: denormalized profile (just id + full_name).
 *   - onDownload: called when the teacher clicks Download.
 *   - onGrade: called with the new grade value (number | null) when the
 *     teacher clicks Save. Returns a Promise — the button shows a spinner
 *     until it resolves.
 */
export function SubmissionCard({
  submission,
  student,
  downloadUrl,
  onDownload,
  onGrade,
}: {
  submission: Submission;
  student: Pick<Profile, "id" | "full_name"> | null;
  downloadUrl?: string;
  onDownload?: () => void;
  onGrade?: (grade: number | null) => Promise<void>;
}) {
  const [grade, setGrade] = useState<string>(
    submission.grade != null ? String(submission.grade) : ""
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filename = submission.file_path.split("/").pop() ?? submission.file_path;
  const color = fileColorFor(filename);
  const isGraded = submission.status === "graded" || submission.grade != null;

  async function handleSave() {
    setError(null);
    const n = grade.trim() === "" ? null : Number(grade);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) {
      setError("Grade must be a number between 0 and 100 (or empty).");
      return;
    }
    setSaving(true);
    try {
      await onGrade?.(n);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 bg-[#FDFBF7] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            {(student?.full_name || "?").slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              {student?.full_name || "Unknown student"}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Submitted {formatDateTime(submission.created_at)}
            </div>
          </div>
        </div>
        <Badge variant={isGraded ? "emerald" : "amber"}>
          {isGraded ? `Graded · ${submission.grade}` : "Pending grade"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900",
            fileColorBgClass(color)
          )}
        >
          <FileIcon className="size-4 text-slate-900" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs text-slate-700">{filename}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {fileColorLabel(color)}
          </div>
        </div>
        {(downloadUrl || onDownload) && (
          <a
            href={downloadUrl}
            download={filename}
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-sky-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
          >
            View file
          </a>
        )}
      </div>

      {/* Grade input row */}
      {onGrade && (
        <div className="flex items-center gap-2 border-t-2 border-slate-200 bg-amber-50 px-4 py-3">
          <label
            htmlFor={`grade-${submission.id}`}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-600"
          >
            Grade /100
          </label>
          <Input
            id={`grade-${submission.id}`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="0–100"
            className="h-9 w-24"
            disabled={saving}
          />
          <Button
            type="button"
            variant="emerald"
            size="sm"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : savedFlash ? (
              <Check className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving…" : savedFlash ? "Saved!" : "Save"}
          </Button>
          {error && (
            <span className="text-xs font-bold text-rose-600">{error}</span>
          )}
        </div>
      )}
    </div>
  );
}
