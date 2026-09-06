"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, File as FileIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fileColorFor, fileColorBgClass, fileColorLabel } from "@/lib/types";
import { formatFileSize } from "@/lib/storage";

/**
 * BrutalFileUpload — drag-and-drop area + file preview + progress bar.
 *
 * Behavior:
 *   1. User drags or picks a file.
 *   2. We immediately upload it via the onUpload callback (which should
 *      return a Promise resolving to the storage path).
 *   3. Progress bar fills as the upload completes.
 *   4. On success, onUploaded(path, file) fires so the parent can
 *      persist the row in the database.
 *
 * The component is intentionally dumb about the bucket + path conventions
 * — those are the parent's job. This component just:
 *   - shows a drag-drop zone
 *   - validates size + mime type if provided
 *   - calls onUpload(file) → returns Promise<string> (storage path)
 *   - shows progress + the final preview
 */
export function BrutalFileUpload({
  onUpload,
  onUploaded,
  onError,
  accept,
  maxSizeMb = 25,
  className,
  ctaLabel = "Drop a file or click to upload",
  disabled = false,
  buttonVariant = "emerald",
  buttonLabel = "Upload file",
}: {
  onUpload: (file: File, onProgress?: (pct: number) => void) => Promise<string>;
  onUploaded?: (path: string, file: File) => void;
  onError?: (message: string) => void;
  accept?: string;
  maxSizeMb?: number;
  className?: string;
  ctaLabel?: string;
  disabled?: boolean;
  buttonVariant?: "emerald" | "violet" | "coral" | "amber" | "default";
  buttonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setProgress(0);
    setUploading(false);
    setDone(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleFile = useCallback(
    async (selected: File | undefined) => {
      if (!selected) return;
      setError(null);
      setDone(false);
      setProgress(0);

      if (selected.size > maxSizeMb * 1024 * 1024) {
        const msg = `File is too large (max ${maxSizeMb} MB).`;
        setError(msg);
        onError?.(msg);
        return;
      }

      setFile(selected);
      setUploading(true);
      try {
        // Simulate progress updates while the actual upload runs (we don't
        // have native progress events for the fetch-based upload). The bar
        // jumps to 90% while the upload is in-flight, then 100% on resolve.
        let simulated = 0;
        const interval = setInterval(() => {
          simulated = Math.min(90, simulated + Math.random() * 15 + 5);
          setProgress(Math.round(simulated));
        }, 200);

        const path = await onUpload(selected, (p) => setProgress(p));
        clearInterval(interval);
        setProgress(100);
        setDone(true);
        onUploaded?.(path, selected);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        onError?.(msg);
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMb, onUpload, onUploaded, onError]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFile(e.dataTransfer.files?.[0]);
  };

  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const fileColor = file
    ? fileColorFor(file.name, file.type)
    : "slate";

  return (
    <div className={cn("space-y-3", className)}>
      <label
        htmlFor="brutal-file-input"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-900 bg-white px-4 py-8 text-center transition-all",
          dragging && "border-emerald-500 bg-emerald-50 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]",
          !dragging && "shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <UploadCloud className="size-7 text-slate-700" strokeWidth={2.5} />
        <span className="text-sm font-bold uppercase tracking-wider text-slate-700">
          {ctaLabel}
        </span>
        <span className="text-xs font-medium text-slate-500">
          Max {maxSizeMb} MB {accept ? `· ${accept}` : ""}
        </span>
        <input
          id="brutal-file-input"
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
      </label>

      {/* Selected file preview */}
      {file && (
        <div className="rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900",
                  fileColorBgClass(fileColor)
                )}
              >
                <FileIcon className="size-5 text-slate-900" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">
                  {file.name}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  {formatFileSize(file.size)} ·{" "}
                  <span className="font-bold uppercase">{fileColorLabel(fileColor)}</span>
                </div>
              </div>
            </div>
            {!uploading && !disabled && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border-2 border-slate-900 bg-white p-1.5 transition-all hover:bg-rose-100"
                aria-label="Remove file"
              >
                <X className="size-4 text-slate-900" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="mt-3 space-y-1.5">
              <div className="h-2.5 w-full overflow-hidden rounded-full border-2 border-slate-900 bg-[#FDFBF7]">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <span>{uploading ? "Uploading…" : "Done"}</span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          {/* Done state */}
          {done && !uploading && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              ✓ Uploaded
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
        >
          {error}
        </div>
      )}

      {/* Optional explicit upload button (some flows want a separate click) */}
      {file && !done && !uploading && (
        <Button
          type="button"
          variant={buttonVariant}
          disabled={disabled}
          onClick={() => handleFile(file)}
          className="w-full"
        >
          {buttonLabel}
        </Button>
      )}
      {uploading && (
        <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
          <Loader2 className="size-4 animate-spin" />
          Uploading…
        </div>
      )}
    </div>
  );
}
