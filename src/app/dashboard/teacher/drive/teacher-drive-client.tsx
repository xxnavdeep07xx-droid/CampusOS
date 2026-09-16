"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  Folder,
  HardDrive,
  Loader2,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fileColorFor,
  fileColorBgClass,
  fileColorLabel,
} from "@/lib/types";
import type { TeacherFile } from "@/lib/types";
import { formatFileSize, formatDate } from "@/lib/storage";

type FileWithClass = TeacherFile & {
  shared_with_class?: { id: string; name: string } | null;
};

/**
 * TeacherDriveClient
 *
 * Folder-based file browser with upload + delete + share.
 *
 * Folder model: each file has a `folder` string (e.g. "Worksheets/Algebra").
 * The current view shows immediate children of the current folder — both
 * files and subfolders. Clicking a subfolder navigates into it.
 */
export function TeacherDriveClient({
  initialFiles,
  classes,
  migrationMissing,
}: {
  initialFiles: FileWithClass[];
  classes: { id: string; name: string }[];
  migrationMissing: boolean;
}) {
  const [files, setFiles] = useState<FileWithClass[]>(initialFiles);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<FileWithClass | null>(null);
  const [shareClassId, setShareClassId] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Build the immediate-children view (folders + files) for the current folder.
  const { visibleFolders, visibleFiles } = useMemo(() => {
    const folders = new Set<string>();
    const filesInFolder: FileWithClass[] = [];
    for (const f of files) {
      const fileFolder = f.folder ?? "";
      if (fileFolder === currentFolder) {
        filesInFolder.push(f);
      } else if (
        currentFolder === ""
          ? fileFolder.includes("/")
          : fileFolder.startsWith(currentFolder + "/")
      ) {
        const afterFolder =
          currentFolder === "" ? fileFolder : fileFolder.slice(currentFolder.length + 1);
        const subName = afterFolder.split("/")[0];
        folders.add(subName);
      }
    }
    return {
      visibleFolders: Array.from(folders).map((name) => ({
        name,
        fullPath: currentFolder === "" ? name : `${currentFolder}/${name}`,
      })),
      visibleFiles: filesInFolder,
    };
  }, [files, currentFolder]);

  const totalSize = files.reduce((s, f) => s + (f.file_size ?? 0), 0);
  const folderBreadcrumbs = currentFolder === "" ? [] : currentFolder.split("/");

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", currentFolder);
      const res = await fetch("/api/teacher-drive", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setFiles((prev) => [{ ...(json.file as TeacherFile), shared_with_class: null }, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: FileWithClass) {
    if (!confirm(`Delete "${file.name}"? This permanently removes the file. This cannot be undone.`)) return;
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    try {
      const res = await fetch(`/api/teacher-drive/${file.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setFiles((prev) => [file, ...prev]);
    }
  }

  async function handleShare() {
    if (!shareTarget) return;
    if (!shareClassId) {
      setShareError("Please select a class.");
      return;
    }
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/teacher-drive/${shareTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithClassId: shareClassId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      // Optimistically update — set the shared_with_class on the file.
      const sharedClass = classes.find((c) => c.id === shareClassId) ?? null;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === shareTarget.id
            ? { ...f, shared_with_class: sharedClass ? { ...sharedClass } : null, shared_with_class_id: shareClassId }
            : f
        )
      );
      setShareTarget(null);
      setShareClassId("");
    } catch (err) {
      setShareError(err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  }

  async function handleUnshare(file: FileWithClass) {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, shared_with_class: null, shared_with_class_id: null } : f))
    );
    try {
      const res = await fetch(`/api/teacher-drive/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithClassId: null }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      // Revert
      setFiles((prev) => prev.map((f) => (f.id === file.id ? file : f)));
    }
  }

  if (migrationMissing) {
    return (
      <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
        <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
        <CardContent className="space-y-2 py-5">
          <h3 className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-amber-700">
            <AlertTriangle className="size-4" /> Phase 10 migration needed
          </h3>
          <p className="text-sm font-medium text-slate-700">
            The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">teacher_files</code> table
            doesn&apos;t exist yet.
          </p>
          <p className="text-xs font-medium text-slate-600">
            Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0010_academic_hub.sql</code>
            {" "}via the Supabase SQL editor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — folder breadcrumbs + upload button + total size */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
          <button
            type="button"
            onClick={() => setCurrentFolder("")}
            className={cn(
              "rounded px-1.5 py-0.5 transition-all hover:bg-amber-100",
              currentFolder === "" && "bg-amber-100"
            )}
          >
            <HardDrive className="inline size-3.5" /> My Drive
          </button>
          {folderBreadcrumbs.map((part, i) => {
            const fullPath = folderBreadcrumbs.slice(0, i + 1).join("/");
            const isLast = i === folderBreadcrumbs.length - 1;
            return (
              <span key={fullPath} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setCurrentFolder(fullPath)}
                  className={cn(
                    "rounded px-1.5 py-0.5 transition-all hover:bg-amber-100",
                    isLast && "bg-amber-100"
                  )}
                >
                  {part}
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
            {files.length} files · {formatFileSize(totalSize)}
          </Badge>
          <UploadButton onFile={handleUpload} uploading={uploading} />
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
        >
          {uploadError}
        </div>
      )}

      {/* Folders grid */}
      {visibleFolders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {visibleFolders.map((f) => (
            <button
              key={f.fullPath}
              type="button"
              onClick={() => setCurrentFolder(f.fullPath)}
              className="group flex flex-col items-center gap-2 rounded-xl border-2 border-slate-900 bg-white p-4 text-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"
            >
              <Folder className="size-8 text-amber-400" strokeWidth={2} />
              <span className="line-clamp-2 text-xs font-bold uppercase tracking-tight text-slate-900">
                {f.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Files grid */}
      {visibleFiles.length === 0 && visibleFolders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HardDrive className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              {currentFolder === "" ? "Your drive is empty" : "This folder is empty"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Upload your first file using the button above.
            </p>
          </CardContent>
        </Card>
      ) : visibleFiles.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {visibleFiles.map((f) => {
            const color = fileColorFor(f.name, f.mime_type);
            return (
              <div
                key={f.id}
                className="group flex flex-col rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"
              >
                <div className={cn("flex h-12 items-center justify-center border-b-2 border-slate-900", fileColorBgClass(color))}>
                  <Download className="size-5 text-slate-900" strokeWidth={2.5} />
                </div>
                <div className="flex flex-1 flex-col p-2">
                  <div className="line-clamp-2 text-xs font-bold uppercase tracking-tight text-slate-900">
                    {f.name}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {fileColorLabel(color)}
                  </div>
                  <div className="text-[10px] font-medium text-slate-500">
                    {formatFileSize(f.file_size ?? 0)} · {formatDate(f.created_at)}
                  </div>
                  {f.shared_with_class && (
                    <Badge variant="emerald" className="mt-2 text-[10px]">
                      Shared with {f.shared_with_class.name}
                    </Badge>
                  )}
                  <div className="mt-2 flex items-center gap-1">
                    {classes.length > 0 && !f.shared_with_class && (
                      <button
                        type="button"
                        onClick={() => {
                          setShareTarget(f);
                          setShareClassId("");
                          setShareError(null);
                        }}
                        className="flex-1 rounded-lg border-2 border-slate-900 bg-sky-100 p-1 transition-all hover:bg-sky-300"
                        aria-label="Share with class"
                        title="Share with a class"
                      >
                        <Share2 className="size-3 text-slate-900" />
                      </button>
                    )}
                    {f.shared_with_class && (
                      <button
                        type="button"
                        onClick={() => handleUnshare(f)}
                        className="flex-1 rounded-lg border-2 border-slate-900 bg-amber-100 p-1 text-[9px] font-bold uppercase tracking-wider hover:bg-amber-300"
                        title="Unshare"
                      >
                        Unshare
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      className="flex-1 rounded-lg border-2 border-slate-900 bg-rose-100 p-1 transition-all hover:bg-rose-400 hover:text-[#FDFBF7]"
                      aria-label="Delete file"
                      title="Delete file"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Share dialog */}
      <Dialog open={shareTarget !== null} onOpenChange={(v) => { if (!v) setShareTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share file with a class</DialogTitle>
            <DialogDescription>
              Share &ldquo;{shareTarget?.name}&rdquo; with one of your classes.
              Students in that class will be able to download it from their class resources.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-class">Class</Label>
              <Select value={shareClassId} onValueChange={setShareClassId}>
                <SelectTrigger id="share-class">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {shareError && (
              <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {shareError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareTarget(null)} disabled={sharing}>
              Cancel
            </Button>
            <Button variant="sky" onClick={handleShare} disabled={sharing || !shareClassId}>
              {sharing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sharing…
                </>
              ) : (
                <>
                  <Share2 className="size-4" />
                  Share
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * UploadButton — invisible file input wrapped in a Button.
 */
function UploadButton({ onFile, uploading }: { onFile: (file: File) => void; uploading: boolean }) {
  return (
    <label className={cn(
      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-violet-400 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(91,33,182,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(91,33,182,1)]",
      uploading && "opacity-50"
    )}>
      {uploading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Uploading…
        </>
      ) : (
        <>
          <Upload className="size-4" strokeWidth={2.5} />
          Upload
        </>
      )}
      <input
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          // Reset so the same file can be re-selected
          e.target.value = "";
        }}
      />
    </label>
  );
}
