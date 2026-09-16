"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SyllabusUnit } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * SyllabusTrackerClient
 *
 * Renders the list of syllabus units with progress bars + an "Add unit"
 * modal. Lets the teacher increment/decrement completed lessons inline.
 */
export function SyllabusTrackerClient({
  initialUnits,
  classes,
  migrationMissing,
}: {
  initialUnits: SyllabusUnit[];
  classes: { id: string; name: string }[];
  migrationMissing: boolean;
}) {
  const [units, setUnits] = useState<SyllabusUnit[]>(initialUnits);
  const [filterClassId, setFilterClassId] = useState<string>("all");

  const filtered = filterClassId === "all"
    ? units
    : units.filter((u) => u.class_id === filterClassId);

  const totalLessons = units.reduce((s, u) => s + u.total_lessons, 0);
  const completedLessons = units.reduce((s, u) => s + u.completed_lessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  async function handleUpdateProgress(unit: SyllabusUnit, newCompleted: number) {
    // Clamp 0..total
    const clamped = Math.max(0, Math.min(newCompleted, unit.total_lessons));
    // Optimistic update
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unit.id
          ? {
              ...u,
              completed_lessons: clamped,
              status: clamped === 0 ? "not_started" : clamped >= u.total_lessons ? "completed" : "in_progress",
            }
          : u
      )
    );
    try {
      const res = await fetch(`/api/syllabus/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedLessons: clamped }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      // Revert on failure
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? unit : u)));
    }
  }

  async function handleDelete(unit: SyllabusUnit) {
    if (!confirm(`Delete "${unit.title}"? This cannot be undone.`)) return;
    setUnits((prev) => prev.filter((u) => u.id !== unit.id));
    try {
      const res = await fetch(`/api/syllabus/${unit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setUnits((prev) => [unit, ...prev]);
    }
  }

  function handleCreated(unit: SyllabusUnit) {
    setUnits((prev) => [...prev, unit]);
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
            The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">syllabus_units</code> table
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
    <div className="space-y-6">
      {/* Overall progress summary */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-400" />
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Overall syllabus progress
              </div>
              <div className="text-3xl font-black text-slate-900">{overallPct}%</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {completedLessons} of {totalLessons} lessons across {units.length} {units.length === 1 ? "unit" : "units"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {classes.length > 0 && (
                <Select value={filterClassId} onValueChange={setFilterClassId}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <AddUnitModal classes={classes} onCreated={handleCreated} />
            </div>
          </div>
          {/* Big overall progress bar */}
          <div className="mt-4 h-4 w-full overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Units list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <TrendingUp className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">No syllabus units yet</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Add your first unit above to start tracking syllabus progress.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => {
            const pct = u.total_lessons > 0 ? Math.round((u.completed_lessons / u.total_lessons) * 100) : 0;
            const cls = classes.find((c) => c.id === u.class_id);
            const statusMeta = STATUS_META[u.status];
            return (
              <Card key={u.id} className="overflow-hidden">
                <div className={cn("h-1.5 w-full border-x-2 border-t-2 border-slate-900", statusMeta.barClass)} />
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border-slate-900", statusMeta.badgeClass)}>
                          {statusMeta.label}
                        </Badge>
                        {cls && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {cls.name}
                          </span>
                        )}
                        {u.target_date && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Target: {formatDate(u.target_date)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-base font-black uppercase tracking-tight text-slate-900">
                        {u.title}
                      </div>
                      {u.description && (
                        <p className="mt-1 text-xs font-medium text-slate-600">{u.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(u)}
                      className="rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7]"
                      aria-label="Delete unit"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100">
                    <div
                      className={cn("h-full transition-all duration-500", statusMeta.barFillClass)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Counter + buttons */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateProgress(u, u.completed_lessons - 1)}
                        disabled={u.completed_lessons === 0}
                        className="flex size-7 items-center justify-center rounded-lg border-2 border-slate-900 bg-slate-100 text-base font-black text-slate-900 transition-all hover:bg-slate-200 disabled:opacity-30"
                        aria-label="Decrease completed lessons"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {u.completed_lessons} / {u.total_lessons}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateProgress(u, u.completed_lessons + 1)}
                        disabled={u.completed_lessons >= u.total_lessons}
                        className="flex size-7 items-center justify-center rounded-lg border-2 border-slate-900 bg-emerald-100 text-base font-black text-slate-900 transition-all hover:bg-emerald-200 disabled:opacity-30"
                        aria-label="Increase completed lessons"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-black text-slate-900">{pct}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; barClass: string; barFillClass: string; badgeClass: string }> = {
  not_started: {
    label: "Not started",
    barClass: "bg-slate-300",
    barFillClass: "bg-slate-400",
    badgeClass: "bg-slate-200 text-slate-900",
  },
  in_progress: {
    label: "In progress",
    barClass: "bg-amber-300",
    barFillClass: "bg-amber-500",
    badgeClass: "bg-amber-200 text-amber-900",
  },
  completed: {
    label: "Completed",
    barClass: "bg-emerald-400",
    barFillClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500 text-[#FDFBF7]",
  },
};

/**
 * AddUnitModal — quick form to create a new syllabus unit.
 */
function AddUnitModal({
  classes,
  onCreated,
}: {
  classes: { id: string; name: string }[];
  onCreated: (unit: SyllabusUnit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? "");
  const [totalLessons, setTotalLessons] = useState("10");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setClassId(classes[0]?.id ?? "");
    setTotalLessons("10");
    setTargetDate("");
    setError(null);
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classId || null,
          title: title.trim(),
          description: description.trim() || undefined,
          totalLessons: Number(totalLessons),
          targetDate: targetDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      onCreated(json.syllabusUnit as SyllabusUnit);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTimeout(reset, 200); }}>
      <DialogTrigger asChild>
        <Button variant="emerald" size="sm">
          <Plus className="size-4" />
          Add unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add syllabus unit</DialogTitle>
          <DialogDescription>
            Track progress through a chapter, topic, or module.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unit-title">Title</Label>
            <Input
              id="unit-title"
              type="text"
              placeholder="e.g. Chapter 3: Cell Biology"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit-desc">Description (optional)</Label>
            <Textarea
              id="unit-desc"
              rows={2}
              placeholder="Brief description of what this unit covers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="unit-class">Class (optional)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="unit-class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No class</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-lessons">Total lessons</Label>
              <Input
                id="unit-lessons"
                type="number"
                min={1}
                max={200}
                value={totalLessons}
                onChange={(e) => setTotalLessons(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit-target">Target date (optional)</Label>
            <Input
              id="unit-target"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          {error && (
            <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
          <Button variant="emerald" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add unit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
