"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Filter,
  Inbox,
  Loader2,
  Save,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SubmissionCard } from "@/components/brutal/submission-card";
import { getSignedDownloadUrl } from "@/lib/storage-client";
import { STUDENT_SUBMISSIONS_BUCKET } from "@/lib/storage";
import type { Submission, Profile } from "@/lib/types";

type AssignmentMap = Record<string, { id: string; title: string; class_id: string; due_date: string | null }>;
type ClassMap = Record<string, { id: string; name: string }>;

type QueueItem = Submission & {
  student?: Pick<Profile, "id" | "full_name"> | null | undefined;
};

/**
 * GradingQueueClient
 *
 * Renders the unified grading queue with:
 *   - search box (filter by student name or assignment title)
 *   - class filter (All / [Class A] / [Class B] / ...)
 *   - inline grade + feedback editing via SubmissionCard + feedback textarea
 *
 * When a teacher saves a grade, the row is removed from the visible list
 * (optimistically) since this page only shows PENDING submissions.
 */
export function GradingQueueClient({
  submissions,
  assignments,
  classes,
}: {
  submissions: QueueItem[];
  assignments: { id: string; title: string; class_id: string; due_date: string | null }[];
  classes: { id: string; name: string }[];
}) {
  const [items, setItems] = useState<QueueItem[]>(submissions);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});

  const assignmentMap = useMemo<AssignmentMap>(() => {
    const m: AssignmentMap = {};
    for (const a of assignments) m[a.id] = a;
    return m;
  }, [assignments]);

  const classMap = useMemo<ClassMap>(() => {
    const m: ClassMap = {};
    for (const c of classes) m[c.id] = c;
    return m;
  }, [classes]);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      // Class filter
      const clsId = assignmentMap[s.assignment_id]?.class_id;
      if (classFilter !== "all" && clsId !== classFilter) return false;
      // Search filter (student name OR assignment title)
      if (search.trim()) {
        const q = search.toLowerCase();
        const studentName = s.student?.full_name?.toLowerCase() ?? "";
        const assignmentTitle = assignmentMap[s.assignment_id]?.title?.toLowerCase() ?? "";
        if (!studentName.includes(q) && !assignmentTitle.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, classFilter, assignmentMap]);

  // Group by class for visual chunking
  const grouped = useMemo(() => {
    const g: Record<string, QueueItem[]> = {};
    for (const s of filtered) {
      const clsId = assignmentMap[s.assignment_id]?.class_id ?? "unknown";
      if (!g[clsId]) g[clsId] = [];
      g[clsId].push(s);
    }
    return g;
  }, [filtered, assignmentMap]);

  async function handleGrade(submissionId: string, grade: number | null, feedback?: string) {
    const res = await fetch(`/api/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade, feedback }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Failed (HTTP ${res.status})`);
    }
    // Remove from pending queue (this page only shows ungraded)
    setItems((prev) => prev.filter((s) => s.id !== submissionId));
  }

  async function handleDownload(filePath: string): Promise<string | undefined> {
    try {
      return await getSignedDownloadUrl(STUDENT_SUBMISSIONS_BUCKET, filePath, 60);
    } catch (err) {
      console.error("download URL error:", err);
      return undefined;
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
        <Inbox className="mx-auto mb-3 size-10 text-emerald-500" />
        <p className="text-base font-black uppercase tracking-tight text-slate-900">
          All caught up
        </p>
        <p className="mt-1 text-sm font-medium text-slate-600">
          No pending submissions across any of your classes. Nice work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student or assignment…"
            className="h-10 w-full rounded-lg border-2 border-slate-200 bg-[#FDFBF7] pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-slate-500" />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-10 rounded-lg border-2 border-slate-200 bg-[#FDFBF7] px-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
          >
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border-2 border-slate-900 bg-amber-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-900">
          {filtered.length} pending
        </div>
      </div>

      {/* Grouped list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white py-10 text-center">
          <p className="text-sm font-bold text-slate-700">
            No submissions match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([clsId, items]) => {
            const cls = classMap[clsId];
            return (
              <div key={clsId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">
                    {cls?.name ?? "Unknown class"}
                    <span className="ml-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      {items.length} pending
                    </span>
                  </h2>
                  <Link
                    href={`/dashboard/classes/${clsId}`}
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
                  >
                    Open class
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <div className="grid gap-3">
                  {items.map((s) => {
                    const assignment = assignmentMap[s.assignment_id];
                    return (
                      <GradingQueueCard
                        key={s.id}
                        submission={s}
                        student={s.student}
                        assignmentTitle={assignment?.title ?? "—"}
                        dueDate={assignment?.due_date ?? null}
                        feedbackDraft={feedbackDrafts[s.id] ?? s.feedback ?? ""}
                        onFeedbackChange={(text) =>
                          setFeedbackDrafts((prev) => ({ ...prev, [s.id]: text }))
                        }
                        onGrade={(grade) =>
                          handleGrade(s.id, grade, feedbackDrafts[s.id] ?? s.feedback ?? undefined)
                        }
                        onDownload={() => handleDownload(s.file_path)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * GradingQueueCard — wraps SubmissionCard with assignment context + an
 * optional feedback textarea (wires up the previously-dead submissions.feedback
 * column).
 */
function GradingQueueCard({
  submission,
  student,
  assignmentTitle,
  dueDate,
  feedbackDraft,
  onFeedbackChange,
  onGrade,
  onDownload,
}: {
  submission: Submission;
  student: Pick<Profile, "id" | "full_name"> | null | undefined;
  assignmentTitle: string;
  dueDate: string | null;
  feedbackDraft: string;
  onFeedbackChange: (text: string) => void;
  onGrade: (grade: number | null) => Promise<void>;
  onDownload: () => Promise<string | undefined>;
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function handleDownloadClick(e: React.MouseEvent) {
    if (downloadUrl) return;
    e.preventDefault();
    const url = await onDownload();
    if (url) setDownloadUrl(url);
  }

  async function handleSaveGrade(grade: number | null) {
    setError(null);
    setSaving(true);
    try {
      await onGrade(grade);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Wrap the SubmissionCard with an assignment-context header + feedback textarea.
  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      {/* Assignment context strip */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-slate-200 bg-slate-900 px-4 py-2 text-[#FDFBF7]">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{assignmentTitle}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {dueDate
              ? `Due ${new Date(dueDate).toLocaleDateString()}`
              : "No due date"}
          </div>
        </div>
        <a
          href={downloadUrl}
          download
          onClick={handleDownloadClick}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#FDFBF7]/30 bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFBF7] transition-all hover:bg-slate-700"
        >
          View file
        </a>
      </div>

      {/* Body — student + grade input */}
      <div className="px-4 py-3">
        <SubmissionCard
          submission={submission}
          student={student ?? null}
          downloadUrl={downloadUrl}
          onDownload={() => { void handleDownloadClick; }}
          onGrade={handleSaveGrade}
        />
      </div>

      {/* Feedback textarea — wires up the previously-dead submissions.feedback column */}
      <div className="border-t-2 border-slate-200 bg-amber-50 px-4 py-3">
        <label
          htmlFor={`feedback-${submission.id}`}
          className="text-[10px] font-bold uppercase tracking-wider text-slate-600"
        >
          Written feedback (optional — saved with the grade)
        </label>
        <textarea
          id={`feedback-${submission.id}`}
          value={feedbackDraft}
          onChange={(e) => onFeedbackChange(e.target.value)}
          rows={2}
          placeholder="e.g. Good effort! Watch out for the formula on question 3."
          className="mt-1.5 w-full resize-y rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          disabled={saving}
        />
        {error && (
          <p className="mt-1.5 text-xs font-bold text-rose-600">{error}</p>
        )}
        {savedFlash && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <Check className="size-3.5" /> Saved &amp; removed from queue
          </p>
        )}
        {saving && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-slate-600">
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </p>
        )}
      </div>
    </div>
  );
}
