"use client";

import { useState } from "react";
import { Clock, Loader2, Plus, Trash2, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAYS_OF_WEEK,
  dayName,
  formatTime,
  type DayOfWeek,
  type ClassRoom,
  type Timetable,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * AddSlotModal — opens a dialog to add a new timetable slot.
 *
 * Fields:
 *   - Class (select from the teacher's classes)
 *   - Day of week (Mon-Fri)
 *   - Start time + end time (HTML time inputs)
 *   - Subject name (optional)
 *
 * On submit → POST /api/timetables. On success, calls onCreated() so the
 * parent (WeekGrid) can re-fetch.
 *
 * If `defaultClassId` is provided, the class selector is pre-selected and hidden.
 * If `defaultDay` is provided, the day is pre-selected.
 */
export function AddSlotModal({
  teacherClasses,
  defaultClassId,
  defaultDay,
  triggerLabel = "Add slot",
  triggerVariant = "emerald",
  onCreated,
}: {
  teacherClasses: Pick<ClassRoom, "id" | "name">[];
  defaultClassId?: string;
  defaultDay?: DayOfWeek;
  triggerLabel?: string;
  triggerVariant?: "emerald" | "violet" | "coral" | "amber" | "default";
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(defaultClassId ?? "");
  const [day, setDay] = useState<DayOfWeek | "">(defaultDay ?? "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setClassId(defaultClassId ?? "");
    setDay(defaultDay ?? "");
    setStartTime("");
    setEndTime("");
    setSubjectName("");
    setCreating(false);
    setError(null);
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleCreate() {
    if (!classId || !day || !startTime || !endTime) {
      setError("Please fill in all required fields.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/timetables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          dayOfWeek: Number(day),
          startTime,
          endTime,
          subjectName: subjectName.trim(),
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

  const hasMultipleClasses = teacherClasses.length > 1;
  const minTime = "07:00";
  const maxTime = "20:00";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a timetable slot</DialogTitle>
          <DialogDescription>
            Schedule a recurring weekly class period. Overlapping slots for
            the same class on the same day will be rejected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasMultipleClasses && (
            <div className="space-y-2">
              <Label htmlFor="slot-class">Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="slot-class">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!hasMultipleClasses && teacherClasses.length === 1 && (
            <div className="rounded-lg border-2 border-slate-900 bg-amber-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              Class: {teacherClasses[0].name}
            </div>
          )}
          {teacherClasses.length === 0 && (
            <div className="rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              You don&apos;t have any classes yet. Create one first.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="slot-day">Day of week</Label>
            <Select
              value={day ? String(day) : ""}
              onValueChange={(v) => setDay(Number(v) as DayOfWeek)}
            >
              <SelectTrigger id="slot-day">
                <SelectValue placeholder="Select a day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="slot-start">
                <Clock className="inline size-3.5" /> Start
              </Label>
              <Input
                id="slot-start"
                type="time"
                min={minTime}
                max={maxTime}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slot-end">
                <Clock className="inline size-3.5" /> End
              </Label>
              <Input
                id="slot-end"
                type="time"
                min={startTime || minTime}
                max={maxTime}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slot-subject">Subject name (optional)</Label>
            <Input
              id="slot-subject"
              type="text"
              placeholder="e.g. Algebra, History, Biology lab"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
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
            variant={triggerVariant}
            onClick={handleCreate}
            disabled={creating || !classId || !day || !startTime || !endTime}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add slot
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SlotCard — a single timetable slot rendered inside a day column.
 *
 * Color-coded by class (hashes the class_id to pick a color). Includes a
 * delete button (X) that calls onDelete.
 */
const CLASS_COLORS = [
  "bg-emerald-400",
  "bg-sky-300",
  "bg-violet-400",
  "bg-amber-300",
  "bg-rose-300",
  "bg-teal-300",
  "bg-orange-300",
  "bg-lime-300",
];

export function SlotCard({
  slot,
  className,
  onDelete,
}: {
  slot: Timetable & { classes?: { name: string } | null };
  className?: string;
  onDelete?: () => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);

  // Pick a stable color from the class id.
  const colorIndex = slot.class_id
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0) % CLASS_COLORS.length;
  const colorClass = CLASS_COLORS[colorIndex];

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]",
        colorClass,
        className
      )}
    >
      <div className="p-2">
        <div className="flex items-start justify-between gap-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-900">
            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border-2 border-slate-900 bg-white/80 p-0.5 transition-all hover:bg-rose-500 hover:text-[#FDFBF7] disabled:opacity-50"
              aria-label="Delete slot"
              title="Delete slot"
            >
              {deleting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </button>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs font-bold text-slate-900">
          {slot.subject_name || "Class period"}
        </div>
        {slot.classes?.name && (
          <div className="truncate text-[10px] font-medium text-slate-800/70">
            {slot.classes.name}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * WeekGrid — the weekly timetable grid.
 *
 * Renders 5 columns (Mon-Fri). Slots are positioned by their start_time
 * (we don't do strict time-axis rendering — slots stack vertically within
 * each day column, sorted by start time). This is simpler and works for
 * most school schedules where periods don't overlap.
 *
 * Pass `canEdit=true` to show an "Add slot" button at the top and delete
 * buttons on each slot.
 */
export function WeekGrid({
  slots,
  canEdit = false,
  teacherClasses,
  onSlotDeleted,
  onSlotCreated,
}: {
  slots: Array<Timetable & { classes?: { name: string } | null }>;
  canEdit?: boolean;
  teacherClasses?: Pick<ClassRoom, "id" | "name">[];
  onSlotDeleted?: () => void;
  onSlotCreated?: () => void;
}) {
  // Group slots by day.
  const slotsByDay: Record<number, Array<Timetable & { classes?: { name: string } | null }>> = {};
  for (const d of DAYS_OF_WEEK) slotsByDay[d.value] = [];
  for (const s of slots) {
    if (!slotsByDay[s.day_of_week]) slotsByDay[s.day_of_week] = [];
    slotsByDay[s.day_of_week].push(s);
  }
  // Sort each day by start_time.
  for (const d of DAYS_OF_WEEK) {
    slotsByDay[d.value].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  async function handleDelete(slotId: string) {
    const res = await fetch(`/api/timetables/${slotId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || `Failed (HTTP ${res.status})`);
    }
    onSlotDeleted?.();
  }

  return (
    <div className="space-y-4">
      {canEdit && teacherClasses && teacherClasses.length > 0 && (
        <div className="flex justify-end">
          <AddSlotModal
            teacherClasses={teacherClasses}
            onCreated={onSlotCreated}
            triggerLabel="Add class period"
            triggerVariant="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {DAYS_OF_WEEK.map((d) => (
          <div
            key={d.value}
            className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
          >
            {/* Day header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 px-3 py-2 text-[#FDFBF7]">
              <span className="text-xs font-black uppercase tracking-wider">
                {d.label}
              </span>
              {canEdit && teacherClasses && teacherClasses.length > 0 && (
                <AddSlotModal
                  teacherClasses={teacherClasses}
                  defaultDay={d.value}
                  onCreated={onSlotCreated}
                  triggerLabel=""
                  triggerVariant="ghost"
                />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {slotsByDay[d.value].length} {slotsByDay[d.value].length === 1 ? "period" : "periods"}
              </span>
            </div>

            {/* Slots */}
            <div className="space-y-2 p-2">
              {slotsByDay[d.value].length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-slate-300 px-2 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  No periods
                </div>
              ) : (
                slotsByDay[d.value].map((s) => (
                  <SlotCard
                    key={s.id}
                    slot={s}
                    onDelete={canEdit ? () => handleDelete(s.id) : undefined}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
