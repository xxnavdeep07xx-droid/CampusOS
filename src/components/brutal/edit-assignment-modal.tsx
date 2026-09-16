"use client";

import { useEffect, useState } from "react";
import { Calendar, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { AssignmentAttachments } from "@/components/brutal/assignment-attachments";
import type { Assignment } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * EditAssignmentModal — teacher dialog for editing an existing assignment.
 *
 * Pre-fills title/description/due_date from the assignment prop.
 * On submit → PATCH /api/assignments/[id]. On success, calls onUpdated()
 * so the parent can refresh the assignment list.
 *
 * Includes a destructive "Delete assignment" action at the bottom — calls
 * DELETE /api/assignments/[id] and a confirmation step.
 */
export function EditAssignmentModal({
  assignment,
  onUpdated,
  onDeleted,
  triggerLabel = "Edit",
}: {
  assignment: Assignment;
  onUpdated?: () => void;
  onDeleted?: () => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? "");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync form state when the assignment prop changes (e.g. after refresh)
  useEffect(() => {
    if (open) {
      setTitle(assignment.title);
      setDescription(assignment.description ?? "");
      // Convert ISO due_date → datetime-local string for the input
      if (assignment.due_date) {
        const d = new Date(assignment.due_date);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDueDate(local);
      } else {
        setDueDate("");
      }
      setConfirmingDelete(false);
      setError(null);
    }
  }, [open, assignment]);

  async function handleSave() {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let isoDue: string | null | undefined = undefined;
      if (dueDate) {
        const d = new Date(dueDate);
        if (!Number.isNaN(d.getTime())) isoDue = d.toISOString();
      } else if (assignment.due_date) {
        // Cleared the due date
        isoDue = null;
      }

      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate: isoDue,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      onUpdated?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      onDeleted?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-amber-100 p-1.5 transition-all hover:bg-amber-300"
          aria-label="Edit assignment"
          title="Edit assignment"
        >
          <Pencil className="size-4" />
          {triggerLabel && <span className="sr-only">{triggerLabel}</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit assignment</DialogTitle>
          <DialogDescription>
            Update the title, description, or due date. Students will see the
            updated version immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-assign-title">Title</Label>
            <Input
              id="edit-assign-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-assign-desc">Description (optional)</Label>
            <Textarea
              id="edit-assign-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-assign-due">
              <Calendar className="inline size-3.5" /> Due date (optional)
            </Label>
            <Input
              id="edit-assign-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {assignment.due_date && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Currently due {formatDate(assignment.due_date)} — clear the field to remove.
              </p>
            )}
          </div>

          {/* Attachments — files + external links */}
          <AssignmentAttachments
            assignmentId={assignment.id}
            classId={assignment.class_id}
          />

          {error && (
            <div
              role="alert"
              className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
            >
              {error}
            </div>
          )}
        </div>

        {/* Destructive zone — separated visually */}
        <div className="mt-2 rounded-xl border-2 border-rose-200 bg-rose-50 p-3">
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 hover:underline"
            >
              <Trash2 className="size-3.5" />
              Delete this assignment
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-rose-700">
                This permanently deletes the assignment + all student submissions.
                This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Yes, delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="coral"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Pencil className="size-4" />
                Save changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export Plus for consumers of the create modal pattern.
export { Plus };
