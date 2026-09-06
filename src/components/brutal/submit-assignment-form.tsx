"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrutalFileUpload } from "@/components/brutal/file-upload";
import { uploadFileToBucket } from "@/lib/storage-client";
import { STUDENT_SUBMISSIONS_BUCKET } from "@/lib/storage";
import type { Submission } from "@/lib/types";

/**
 * SubmitAssignmentForm — the file-upload + persist flow used by the student
 * assignment detail page.
 *
 * Flow:
 *   1. BrutalFileUpload uploads the file to student_submissions via /api/upload
 *      (signed URL flow).
 *   2. On upload success, the user sees a "Submit" button.
 *   3. Clicking Submit → POST /api/submissions with the storage path.
 *   4. UPSERT means re-submitting overwrites the existing submission.
 *   5. On success, refresh the page so the server component re-renders with
 *      the new submission state.
 */
export function SubmitAssignmentForm({
  classId,
  assignmentId,
  existingSubmission,
}: {
  classId: string;
  assignmentId: string;
  existingSubmission?: Submission | null;
}) {
  const router = useRouter();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!filePath || !uploadedFile) {
      setError("Please upload a file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          filePath,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setDone(true);
      // Refresh server-rendered data.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]">
        <Check className="mr-2 inline size-4" />
        Submitted! Refreshing…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BrutalFileUpload
        accept="*"
        maxSizeMb={25}
        ctaLabel={
          existingSubmission
            ? "Drop a new file to re-submit"
            : "Drop a file or click to upload"
        }
        buttonLabel="Upload file"
        buttonVariant="violet"
        onUpload={async (file) => {
          const path = await uploadFileToBucket({
            bucket: STUDENT_SUBMISSIONS_BUCKET,
            classId,
            file,
          });
          return path;
        }}
        onUploaded={(path, file) => {
          setFilePath(path);
          setUploadedFile(file);
        }}
        onError={(msg) => setError(msg)}
      />

      {filePath && uploadedFile && (
        <Button
          type="button"
          variant="violet"
          size="lg"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Upload className="size-4" />
              {existingSubmission ? "Re-submit work" : "Submit assignment"}
            </>
          )}
        </Button>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
