"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { SubmissionCard } from "@/components/brutal/submission-card";
import { SkeletonList, InlineSpinner } from "@/components/brutal/skeleton";
import { getSignedDownloadUrl } from "@/lib/storage-client";
import { STUDENT_SUBMISSIONS_BUCKET } from "@/lib/storage";
import type { Submission, Profile } from "@/lib/types";

/**
 * GradeSubmissionsList — loads submissions for one assignment, renders a
 * list of SubmissionCard components with grade inputs.
 *
 * Used by the teacher's classroom view (Assignments tab → expand an
 * assignment → see submissions).
 */
export function GradeSubmissionsList({ assignmentId }: { assignmentId: string }) {
  const [submissions, setSubmissions] = useState<
    Array<
      Submission & {
        student?: Pick<Profile, "id" | "full_name"> | null;
      }
    >
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/submissions?assignmentId=${assignmentId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setSubmissions(json.submissions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs, refreshKey]);

  async function handleGrade(submissionId: string, grade: number | null) {
    const res = await fetch(`/api/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Failed (HTTP ${res.status})`);
    }
    // Optimistically update the local state.
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? { ...s, grade, status: grade !== null ? "graded" : "submitted" }
          : s
      )
    );
  }

  async function handleDownload(filePath: string): Promise<string | undefined> {
    try {
      return await getSignedDownloadUrl(STUDENT_SUBMISSIONS_BUCKET, filePath, 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <InlineSpinner label="Loading submissions…" />
        <SkeletonList count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
      >
        <AlertCircle className="mr-2 inline size-4" />
        {error}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-900 bg-white px-4 py-6 text-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <Inbox className="mx-auto mb-2 size-6 text-slate-500" />
        <p className="text-sm font-bold text-slate-700">No submissions yet</p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          When students submit their work, it&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
        <span>{submissions.length} {submissions.length === 1 ? "submission" : "submissions"}</span>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="rounded-lg border-2 border-slate-900 bg-white px-2 py-1 transition-all hover:bg-amber-100"
          aria-label="Refresh"
        >
          <Loader2 className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-3">
        {submissions.map((s) => (
          <SubmissionsCardWithDownload
            key={s.id}
            submission={s}
            student={s.student}
            onGrade={(grade) => handleGrade(s.id, grade)}
            onDownload={() => handleDownload(s.file_path)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Wrapper that asynchronously resolves the signed download URL for a
 * submission and passes it to SubmissionCard.
 */
function SubmissionsCardWithDownload({
  submission,
  student,
  onGrade,
  onDownload,
}: {
  submission: Submission;
  student: Pick<Profile, "id" | "full_name"> | null;
  onGrade: (grade: number | null) => Promise<void>;
  onDownload: () => Promise<string | undefined>;
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    // Only fetch the signed URL on click — saves us from generating
    // one per row on initial render.
    if (downloadUrl) return; // already cached
    e.preventDefault();
    setLoading(true);
    const url = await onDownload();
    if (url) setDownloadUrl(url);
    setLoading(false);
  }

  return (
    <SubmissionCard
      submission={submission}
      student={student}
      downloadUrl={downloadUrl}
      onDownload={handleClick}
      onGrade={onGrade}
    />
  );
}
