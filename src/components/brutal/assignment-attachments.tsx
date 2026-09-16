"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  File as FileIcon,
  Loader2,
  Link2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fileColorFor,
  fileColorBgClass,
  fileColorLabel,
  type AssignmentResource,
} from "@/lib/types";
import { formatFileSize, formatDate } from "@/lib/storage";
import { publicStorageUrl, CLASS_MATERIALS_BUCKET } from "@/lib/storage";

/**
 * AssignmentAttachments — manage the file + link attachments for a single
 * assignment.
 *
 * Used inside the EditAssignmentModal. Lets the teacher:
 *   - List existing attachments (with download link for files, external link for URLs)
 *   - Upload a new file attachment (multipart POST → /api/assignment-resources)
 *   - Add a new link attachment (JSON POST)
 *   - Delete any attachment (DELETE /api/assignment-resources/[id])
 *
 * Files are stored in the `class_materials` bucket under <class_id>/<uuid>.<ext>
 * (same convention as class resources) — RLS enforces the caller is the class teacher.
 */
export function AssignmentAttachments({
  assignmentId,
  classId,
}: {
  assignmentId: string;
  classId: string;
}) {
  const [resources, setResources] = useState<AssignmentResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    async function fetchResources() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/assignment-resources?assignmentId=${assignmentId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
        if (!cancelled) setResources(json.resources ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchResources();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("assignmentId", assignmentId);
      formData.append("file", file);
      formData.append("label", file.name);
      const res = await fetch("/api/assignment-resources", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setResources((prev) => [...prev, json.resource as AssignmentResource]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleAddLink() {
    if (!linkUrl.trim() || !linkLabel.trim()) {
      setError("Both label and URL are required for a link attachment.");
      return;
    }
    if (!/^https?:\/\//i.test(linkUrl.trim())) {
      setError("URL must start with http:// or https://");
      return;
    }
    setAddingLink(true);
    setError(null);
    try {
      const res = await fetch("/api/assignment-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          kind: "link",
          url: linkUrl.trim(),
          label: linkLabel.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setResources((prev) => [...prev, json.resource as AssignmentResource]);
      setLinkLabel("");
      setLinkUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingLink(false);
    }
  }

  async function handleDelete(resource: AssignmentResource) {
    if (!confirm(`Delete "${resource.label}"? This cannot be undone.`)) return;
    setDeletingId(resource.id);
    setError(null);
    // Optimistic removal
    setResources((prev) => prev.filter((r) => r.id !== resource.id));
    try {
      const res = await fetch(`/api/assignment-resources/${resource.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      // Revert on failure
      setResources((prev) => [...prev, resource]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-black uppercase tracking-wider text-slate-600">
          Attachments ({resources.length})
        </Label>
        <FileUploadButton onFile={handleFileUpload} uploading={uploadingFile} />
      </div>

      {/* Existing attachments list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Loader2 className="size-3.5 animate-spin" />
          Loading attachments…
        </div>
      ) : resources.length === 0 ? (
        <p className="py-2 text-center text-xs font-medium text-slate-500">
          No attachments yet. Upload a file or add a link below.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {resources.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5"
            >
              {r.kind === "file" ? (
                <FileAttachmentRow
                  resource={r}
                  classId={classId}
                  deleting={deletingId === r.id}
                  onDelete={() => handleDelete(r)}
                />
              ) : (
                <LinkAttachmentRow
                  resource={r}
                  deleting={deletingId === r.id}
                  onDelete={() => handleDelete(r)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add link form */}
      <div className="space-y-2 border-t-2 border-slate-200 pt-3">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Add a link (Zoom, video, external resource)
        </Label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Label (e.g. Lecture recording)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            className="h-9 flex-1 text-sm"
            disabled={addingLink}
          />
          <Input
            type="url"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="h-9 flex-1 text-sm"
            disabled={addingLink}
          />
          <Button
            type="button"
            variant="sky"
            size="sm"
            onClick={handleAddLink}
            disabled={addingLink || !linkLabel.trim() || !linkUrl.trim()}
            className="h-9"
          >
            {addingLink ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function FileAttachmentRow({
  resource,
  classId,
  deleting,
  onDelete,
}: {
  resource: AssignmentResource;
  classId: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  const filename = resource.storage_path?.split("/").pop() ?? resource.label;
  const color = fileColorFor(filename, resource.mime_type);
  const downloadUrl = resource.storage_path
    ? publicStorageUrl(CLASS_MATERIALS_BUCKET, resource.storage_path)
    : undefined;

  return (
    <>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded border-2 border-slate-900",
          fileColorBgClass(color)
        )}
      >
        <FileIcon className="size-3.5 text-slate-900" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-slate-900">{resource.label}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {fileColorLabel(color)}
          {resource.file_size != null && <> · {formatFileSize(resource.file_size)}</>}
        </div>
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border-2 border-slate-900 bg-sky-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 hover:bg-sky-400"
          title="Open file"
        >
          <ExternalLink className="size-3" />
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="rounded border-2 border-slate-900 bg-rose-100 p-1 text-rose-700 transition-all hover:bg-rose-400 hover:text-[#FDFBF7] disabled:opacity-50"
        aria-label="Delete attachment"
      >
        {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </>
  );
}

function LinkAttachmentRow({
  resource,
  deleting,
  onDelete,
}: {
  resource: AssignmentResource;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="flex size-7 shrink-0 items-center justify-center rounded border-2 border-slate-900 bg-violet-300">
        <Link2 className="size-3.5 text-slate-900" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-slate-900">{resource.label}</div>
        <div className="truncate text-[10px] font-medium text-slate-500">{resource.url}</div>
      </div>
      <a
        href={resource.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded border-2 border-slate-900 bg-sky-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 hover:bg-sky-400"
        title="Open link"
      >
        <ExternalLink className="size-3" />
      </a>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="rounded border-2 border-slate-900 bg-rose-100 p-1 text-rose-700 transition-all hover:bg-rose-400 hover:text-[#FDFBF7] disabled:opacity-50"
        aria-label="Delete attachment"
      >
        {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </>
  );
}

function FileUploadButton({
  onFile,
  uploading,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-lg border-2 border-slate-900 bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFBF7] shadow-[1.5px_1.5px_0px_0px_rgba(5,150,105,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2.5px_2.5px_0px_0px_rgba(5,150,105,1)]",
        uploading && "opacity-50"
      )}
    >
      {uploading ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          Uploading…
        </>
      ) : (
        <>
          <Upload className="size-3" strokeWidth={2.5} />
          Upload file
        </>
      )}
      <input
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
