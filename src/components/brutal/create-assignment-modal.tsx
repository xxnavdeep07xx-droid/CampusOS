"use client";

import { useState } from "react";
import { Calendar, Loader2, Plus } from "lucide-react";
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

/**
 * CreateAssignmentModal — teacher dialog for creating a new assignment.
 *
 * Fields: title, description, due_date (datetime-local input).
 *
 * On submit → POST /api/assignments. On success, calls onCreated() so the
 * parent can refresh the assignment list.
 */
export function CreateAssignmentModal({
  classId,
  triggerLabel = "Create assignment",
  onCreated,
}: {
  classId: string;
  triggerLabel?: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setCreating(false);
    setError(null);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleCreate() {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setCreating(true);
    setError(null);

    try {
      // Convert the datetime-local string to an ISO string with timezone.
      let isoDue: string | null = null;
      if (dueDate) {
        const d = new Date(dueDate);
        if (!Number.isNaN(d.getTime())) isoDue = d.toISOString();
      }

      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: title.trim(),
          description: description.trim(),
          dueDate: isoDue,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      onCreated?.();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  // Min datetime = now (so teachers can't set past due dates accidentally).
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="coral">
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an assignment</DialogTitle>
          <DialogDescription>
            Students in this class will see it in their &ldquo;Pending assignments&rdquo; list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assign-title">Title</Label>
            <Input
              id="assign-title"
              type="text"
              placeholder="e.g. Homework 3 — Quadratic equations"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-desc">Description (optional)</Label>
            <Textarea
              id="assign-desc"
              rows={4}
              placeholder="Instructions for the students — what to submit, how it'll be graded, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-due">
              <Calendar className="inline size-3.5" /> Due date (optional)
            </Label>
            <Input
              id="assign-due"
              type="datetime-local"
              min={nowLocal}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

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
          <Button variant="outline" onClick={close} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="coral"
            onClick={handleCreate}
            disabled={creating || !title.trim()}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Create assignment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
