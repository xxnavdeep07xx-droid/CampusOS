"use client";

import { useState } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrutalFileUpload } from "@/components/brutal/file-upload";
import { uploadFileToBucket } from "@/lib/storage-client";
import { CLASS_MATERIALS_BUCKET } from "@/lib/storage";

/**
 * UploadResourceModal — teacher dialog for uploading a file to the
 * `class_materials` bucket and creating a `resources` row.
 *
 * Flow:
 *   1. User picks a file → BrutalFileUpload handles the upload to Supabase
 *      Storage via /api/upload (signed URL flow).
 *   2. Once uploaded, user fills in title + description (title is pre-
 *      filled with the filename, user can edit).
 *   3. User clicks "Publish" → POST /api/resources with the storage path.
 *   4. onSuccess(path) fires so the parent can refresh.
 */
export function UploadResourceModal({
  classId,
  triggerLabel = "Upload resource",
  onPublished,
}: {
  classId: string;
  triggerLabel?: string;
  /** Notified when a new resource is persisted so the parent can refetch. */
  onPublished?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFilePath(null);
    setUploadedFile(null);
    setTitle("");
    setDescription("");
    setPublishing(false);
    setError(null);
  }

  function close() {
    setOpen(false);
    // Defer reset so the close animation isn't interrupted.
    setTimeout(reset, 200);
  }

  async function handlePublish() {
    if (!filePath || !uploadedFile) {
      setError("Please upload a file first.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: title.trim(),
          description: description.trim(),
          filePath,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.type,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed to publish (HTTP ${res.status})`);
      }
      onPublished?.();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="emerald">
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a resource</DialogTitle>
          <DialogDescription>
            Files go to the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">class_materials</code>
            bucket. Students in this class can download them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <BrutalFileUpload
            accept="*"
            maxSizeMb={25}
            ctaLabel="Drop a file or click to upload"
            buttonLabel="Upload file"
            buttonVariant="emerald"
            onUpload={async (file) => {
              // POST /api/upload returns the signed URL; we PUT the file
              // and return the final storage path.
              const path = await uploadFileToBucket({
                bucket: CLASS_MATERIALS_BUCKET,
                classId,
                file,
              });
              return path;
            }}
            onUploaded={(path, file) => {
              setFilePath(path);
              setUploadedFile(file);
              // Pre-fill the title with the filename (without extension).
              const baseName = file.name.replace(/\.[^.]+$/, "");
              setTitle((prev) => prev || baseName);
            }}
            onError={(msg) => setError(msg)}
          />

          {filePath && (
            <div className="space-y-4 border-t-2 border-slate-200 pt-4">
              <div className="space-y-2">
                <Label htmlFor="resource-title">Title</Label>
                <Input
                  id="resource-title"
                  type="text"
                  placeholder="e.g. Week 3 Lecture Slides"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource-desc">Description (optional)</Label>
                <Textarea
                  id="resource-desc"
                  rows={3}
                  placeholder="A short description so students know what this file contains."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={publishing}>
            Cancel
          </Button>
          <Button
            variant="emerald"
            onClick={handlePublish}
            disabled={!filePath || publishing}
          >
            {publishing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Publish resource
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
