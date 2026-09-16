"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Loader2,
  Plus,
  Trash2,
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
import type { LessonPlan } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * LessonPlansClient
 *
 * Renders a 7-day week grid (Mon–Sun) showing lesson plans per day.
 * Click any day to open the create/edit modal pre-filled with that date.
 */
export function LessonPlansClient({
  initialLessons,
  classes,
  syllabusUnits,
  migrationMissing,
}: {
  initialLessons: LessonPlan[];
  classes: { id: string; name: string }[];
  syllabusUnits: { id: string; title: string; class_id: string | null }[];
  migrationMissing: boolean;
}) {
  const [lessons, setLessons] = useState<LessonPlan[]>(initialLessons);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LessonPlan | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const lessonsByDate = useMemo(() => {
    const m: Record<string, LessonPlan[]> = {};
    for (const l of lessons) {
      if (!l.lesson_date) continue;
      if (!m[l.lesson_date]) m[l.lesson_date] = [];
      m[l.lesson_date].push(l);
    }
    return m;
  }, [lessons]);

  function shiftWeek(days: number) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + days);
    setWeekStart(d);
  }

  function openCreate(dateStr: string) {
    setEditTarget(null);
    setEditDate(dateStr);
    setEditModalOpen(true);
  }

  function openEdit(lesson: LessonPlan) {
    setEditTarget(lesson);
    setEditDate(lesson.lesson_date);
    setEditModalOpen(true);
  }

  function handleCreated(lesson: LessonPlan) {
    setLessons((prev) => [...prev, lesson]);
  }

  function handleUpdated(lesson: LessonPlan) {
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? lesson : l)));
  }

  async function handleDelete(lesson: LessonPlan) {
    if (!confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;
    setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
    try {
      const res = await fetch(`/api/lesson-plans/${lesson.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setLessons((prev) => [lesson, ...prev]);
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
            The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">lesson_plans</code> table
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

  const isThisWeek = isSameDay(weekStart, getMonday(new Date()));

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => shiftWeek(-7)}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[180px] text-center text-sm font-black uppercase tracking-tight text-slate-900">
            {formatDate(toDateInput(weekStart))} – {formatDate(toDateInput(weekDays[6]))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => shiftWeek(7)}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isThisWeek && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(getMonday(new Date()))}
            >
              This week
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="emerald">
            {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} this window
          </Badge>
          <EditLessonModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            target={editTarget}
            initialDate={editDate}
            classes={classes}
            syllabusUnits={syllabusUnits}
            onCreated={handleCreated}
            onUpdated={handleUpdated}
            trigger={
              <Button variant="sky" size="sm">
                <Plus className="size-4" />
                New lesson
              </Button>
            }
          />
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {weekDays.map((d, i) => {
          const dateStr = toDateInput(d);
          const dayLessons = lessonsByDate[dateStr] ?? [];
          const isToday = isSameDay(d, new Date());
          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[200px] overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]",
                isToday && "ring-2 ring-emerald-500 ring-offset-2"
              )}
            >
              <div className={cn(
                "flex items-center justify-between border-b-2 border-slate-900 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider",
                isToday ? "bg-emerald-500 text-[#FDFBF7]" : "bg-slate-900 text-[#FDFBF7]"
              )}>
                <span>{DAYS_OF_WEEK[i]}</span>
                <button
                  type="button"
                  onClick={() => openCreate(dateStr)}
                  className="rounded-full p-0.5 transition-all hover:bg-[#FDFBF7]/20"
                  aria-label={`Add lesson for ${DAYS_OF_WEEK[i]}`}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {d.getDate()}/{d.getMonth() + 1}
              </div>
              <div className="space-y-1.5 px-1.5 pb-2">
                {dayLessons.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openCreate(dateStr)}
                    className="w-full rounded-lg border-2 border-dashed border-slate-200 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-all hover:border-slate-900 hover:bg-amber-50"
                  >
                    + Lesson
                  </button>
                ) : (
                  dayLessons.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => openEdit(l)}
                      className={cn(
                        "block w-full overflow-hidden rounded-lg border-2 border-slate-900 bg-[#FDFBF7] px-1.5 py-1 text-left transition-all hover:bg-amber-50",
                        l.status === "published" ? "border-emerald-500" : "border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <Clock className="size-2.5" />
                        {l.duration_min}m
                      </div>
                      <div className="truncate text-xs font-bold text-slate-900">
                        {l.title}
                      </div>
                      {l.class_id && (
                        <div className="truncate text-[10px] font-medium text-slate-500">
                          {classes.find((c) => c.id === l.class_id)?.name ?? "—"}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  date.setDate(date.getDate() + diff);
  return date;
}

function toDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * EditLessonModal — create + edit modal. When `target` is provided,
 * the form is pre-filled with that lesson plan's values; otherwise
 * it's in create mode using `initialDate`.
 */
function EditLessonModal({
  open,
  onOpenChange,
  target,
  initialDate,
  classes,
  syllabusUnits,
  onCreated,
  onUpdated,
  trigger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: LessonPlan | null;
  initialDate: string | null;
  classes: { id: string; name: string }[];
  syllabusUnits: { id: string; title: string; class_id: string | null }[];
  onCreated: (lesson: LessonPlan) => void;
  onUpdated: (lesson: LessonPlan) => void;
  trigger: React.ReactNode;
}) {
  const [title, setTitle] = useState(target?.title ?? "");
  const [body, setBody] = useState(target?.body ?? "");
  const [classId, setClassId] = useState<string>(target?.class_id ?? classes[0]?.id ?? "");
  const [lessonDate, setLessonDate] = useState<string>(target?.lesson_date ?? initialDate ?? toDateInput(new Date()));
  const [durationMin, setDurationMin] = useState(String(target?.duration_min ?? 45));
  const [objectives, setObjectives] = useState((target?.objectives ?? []).join("\n"));
  const [materials, setMaterials] = useState((target?.materials ?? []).join("\n"));
  const [status, setStatus] = useState<"draft" | "published">(target?.status ?? "draft");
  const [syllabusUnitId, setSyllabusUnitId] = useState<string>(target?.syllabus_unit_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when target changes (modal re-opens).
  useMemo(() => {
    if (open) {
      setTitle(target?.title ?? "");
      setBody(target?.body ?? "");
      setClassId(target?.class_id ?? classes[0]?.id ?? "");
      setLessonDate(target?.lesson_date ?? initialDate ?? toDateInput(new Date()));
      setDurationMin(String(target?.duration_min ?? 45));
      setObjectives((target?.objectives ?? []).join("\n"));
      setMaterials((target?.materials ?? []).join("\n"));
      setStatus(target?.status ?? "draft");
      setSyllabusUnitId(target?.syllabus_unit_id ?? "");
      setError(null);
    }
  }, [open, target, initialDate, classes]);

  async function handleSave() {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const objectivesArr = objectives.split("\n").map((s) => s.trim()).filter(Boolean);
    const materialsArr = materials.split("\n").map((s) => s.trim()).filter(Boolean);
    const payload = {
      classId: classId || null,
      lessonDate,
      title: title.trim(),
      body: body.trim() || undefined,
      durationMin: Number(durationMin),
      objectives: objectivesArr,
      materials: materialsArr,
      status,
      syllabusUnitId: syllabusUnitId || null,
    };
    try {
      if (target) {
        const res = await fetch(`/api/lesson-plans/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
        onUpdated(json.lessonPlan as LessonPlan);
      } else {
        const res = await fetch("/api/lesson-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
        onCreated(json.lessonPlan as LessonPlan);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Edit lesson plan" : "New lesson plan"}</DialogTitle>
          <DialogDescription>
            {target ? "Update the lesson details below." : "Plan a lesson — objectives, materials, and link to a syllabus unit if applicable."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lp-title">Title</Label>
            <Input
              id="lp-title"
              type="text"
              placeholder="e.g. Photosynthesis overview"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lp-class">Class (optional)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="lp-class">
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
              <Label htmlFor="lp-date">
                <Calendar className="inline size-3.5" /> Lesson date
              </Label>
              <Input
                id="lp-date"
                type="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lp-duration">Duration (min)</Label>
              <Input
                id="lp-duration"
                type="number"
                min={1}
                max={600}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
                <SelectTrigger id="lp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-body">Body / notes</Label>
            <Textarea
              id="lp-body"
              rows={3}
              placeholder="Lesson plan body — what to cover, sequence of activities…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-objectives">Objectives (one per line)</Label>
            <Textarea
              id="lp-objectives"
              rows={3}
              placeholder={"e.g.\nDefine photosynthesis\nExplain the role of chlorophyll"}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-materials">Materials (one per line)</Label>
            <Textarea
              id="lp-materials"
              rows={2}
              placeholder={"e.g.\nSlides deck\nWorksheet 5"}
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
            />
          </div>
          {syllabusUnits.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="lp-unit">Link to syllabus unit (optional)</Label>
              <Select value={syllabusUnitId} onValueChange={setSyllabusUnitId}>
                <SelectTrigger id="lp-unit">
                  <SelectValue placeholder="No unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No unit</SelectItem>
                  {syllabusUnits
                    .filter((u) => !classId || u.class_id === classId || u.class_id === null)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="sky"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : target ? (
              <>
                <Edit3 className="size-4" />
                Save changes
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Create lesson
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
