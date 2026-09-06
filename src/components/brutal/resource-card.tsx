"use client";

import { Download, File as FileIcon, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  fileColorFor,
  fileColorBgClass,
  fileColorLabel,
  type Resource,
} from "@/lib/types";
import { formatFileSize, formatDate } from "@/lib/storage";

/**
 * ResourceCard — a brutalist card showing a single resource uploaded by the
 * teacher. Color-coded by file type (PDF=sky, doc=emerald, image=coral, etc.).
 *
 * Used by both the teacher classroom view (with delete button) and the
 * student classroom view (with download button).
 */
export function ResourceCard({
  resource,
  downloadUrl,
  onDownload,
  onDelete,
  downloading = false,
}: {
  resource: Resource;
  /** The href to download from (signed URL for private bucket, public URL for public bucket). */
  downloadUrl?: string;
  /** Optional async handler — clicking Download triggers this. */
  onDownload?: () => void;
  /** Optional delete handler — only shown for teachers. */
  onDelete?: () => void;
  downloading?: boolean;
}) {
  const filename = resource.file_path.split("/").pop() ?? resource.file_path;
  const color = fileColorFor(filename, resource.mime_type);

  return (
    <div className="group relative overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]">
      {/* Accent bar */}
      <div className={cn("h-1.5 w-full border-x-2 border-t-2 border-slate-900", fileColorBgClass(color))} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900",
                fileColorBgClass(color)
              )}
            >
              <FileIcon className="size-5 text-slate-900" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold uppercase tracking-tight text-slate-900">
                {resource.title}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-600">
                {resource.description || "No description provided."}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0", fileColorBgClass(color), "border-slate-900")}
          >
            {fileColorLabel(color)}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-slate-200 pt-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>{formatFileSize(resource.file_size)}</span>
            <span>·</span>
            <span>{formatDate(resource.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7]"
                aria-label="Delete resource"
                title="Delete resource"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            {(downloadUrl || onDownload) && (
              <a
                href={downloadUrl}
                download={filename}
                onClick={onDownload}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-emerald-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]",
                  downloading && "opacity-50",
                )}
              >
                <Download className="size-3.5" />
                {downloading ? "Downloading…" : "Download"}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline icon used in some empty-state placeholders. Re-exported for convenience. */
export function ResourceCardMenuIcon() {
  return <MoreVertical className="size-4" />;
}
