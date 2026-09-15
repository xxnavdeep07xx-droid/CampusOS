"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import type { Quiz, QuizQuestion } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * QuizResultsTeacherView
 *
 * Renders the teacher's view of a single quiz: per-student scores, per-question
 * breakdown, plus edit + delete actions for the quiz itself.
 *
 * The teacher sees the correct_answer for each question (used to render the
 * "correct answer" column in the per-question breakdown).
 */
export function QuizResultsTeacherView({
  quiz,
  questions,
  attempts,
  className,
  classId,
  isTeacher,
  migrationMissing,
}: {
  quiz: Quiz;
  questions: QuizQuestion[];
  attempts: any[];
  className: string;
  classId: string;
  isTeacher: boolean;
  migrationMissing: boolean;
}) {
  // Stats
  const stats = useMemo(() => {
    const completed = attempts.filter((a) => a.status === "completed");
    const inProgress = attempts.filter((a) => a.status === "in_progress");
    if (completed.length === 0) {
      return {
        completedCount: 0,
        inProgressCount: inProgress.length,
        avgScore: null,
        maxScore: questions.reduce((s, q) => s + (q.points ?? 0), 0),
        highest: null,
        lowest: null,
      };
    }
    const scores = completed
      .map((a) => (typeof a.score === "number" ? a.score : 0))
      .filter((s) => Number.isFinite(s));
    const maxScore = completed[0]?.max_score ?? questions.reduce((s, q) => s + (q.points ?? 0), 0);
    const sum = scores.reduce((s, n) => s + n, 0);
    return {
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      avgScore: scores.length > 0 ? Math.round((sum / scores.length / (maxScore || 1)) * 100) : null,
      maxScore,
      highest: scores.length > 0 ? Math.max(...scores) : null,
      lowest: scores.length > 0 ? Math.min(...scores) : null,
    };
  }, [attempts, questions]);

  // Per-question stats: how many students got this question right?
  const questionStats = useMemo(() => {
    return questions.map((q, idx) => {
      const completed = attempts.filter((a) => a.status === "completed");
      let correctCount = 0;
      let attemptedCount = 0;
      for (const a of completed) {
        const ans = (a.answers as Record<string, unknown> | null)?.[q.id];
        if (ans != null && ans !== "") {
          attemptedCount++;
          if (String(ans) === String(q.correct_answer)) {
            correctCount++;
          }
        }
      }
      const pct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : null;
      return { question: q, idx, correctCount, attemptedCount, pct };
    });
  }, [questions, attempts]);

  if (migrationMissing) {
    return (
      <div className="space-y-6">
        <Tag color="bg-amber-200">Phase 5 migration needed</Tag>
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Quizzes aren&apos;t set up yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              Apply{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                supabase/migrations/0005_quizzes_gradebook.sql
              </code>{" "}
              to enable quiz results tracking.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to {className}
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-rose-300">Quiz results</Tag>
          <Badge variant={quiz.is_published ? "emerald" : "outline"}>
            {quiz.is_published ? "Published" : "Draft"}
          </Badge>
          {isTeacher && <EditQuizModal quiz={quiz} />}
          {isTeacher && <DeleteQuizButton quiz={quiz} classId={classId} />}
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {quiz.title}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {className}
          {quiz.due_date && (
            <>
              {" · "}Due {formatDate(quiz.due_date)}
            </>
          )}
          {" · "}{questions.length} question{questions.length === 1 ? "" : "s"}
        </p>
        {quiz.description && (
          <p className="mt-2 text-sm text-slate-700">{quiz.description}</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Completed" value={stats.completedCount} icon={<CheckCircle2 className="size-4" />} color="bg-emerald-400" />
        <StatBlock label="In progress" value={stats.inProgressCount} icon={<Clock className="size-4" />} color="bg-amber-300" />
        <StatBlock label="Average" value={stats.avgScore !== null ? `${stats.avgScore}%` : "—"} icon={<BarChart3 className="size-4" />} color="bg-sky-300" />
        <StatBlock label="Out of" value={`${stats.maxScore} pts`} icon={<HelpCircle className="size-4" />} color="bg-violet-400" />
      </div>

      {/* Per-student results table */}
      <div className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight">Per-student results</h2>
        {attempts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <HelpCircle className="mx-auto mb-2 size-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">No attempts yet</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Once students start taking this quiz, their attempts will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="divide-y-2 divide-slate-200 p-0">
              <div className="grid grid-cols-12 gap-3 bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[#FDFBF7]">
                <div className="col-span-6">Student</div>
                <div className="col-span-2 text-right">Score</div>
                <div className="col-span-2 text-right">Status</div>
                <div className="col-span-2 text-right">Submitted</div>
              </div>
              {attempts.map((a) => {
                const score = typeof a.score === "number" ? a.score : 0;
                const maxScore = typeof a.max_score === "number" ? a.max_score : stats.maxScore;
                const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                const studentName = a.student?.full_name ?? "Unknown";
                return (
                  <div key={a.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                    <div className="col-span-6 min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{studentName}</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-black ${pct >= 90 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-rose-700"}`}>
                        {a.status === "completed" ? `${score}/${maxScore}` : "—"}
                      </span>
                      {a.status === "completed" && (
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{pct}%</div>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      {a.status === "completed" ? (
                        <Badge variant="emerald">Completed</Badge>
                      ) : (
                        <Badge variant="amber">In progress</Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-xs text-slate-500">
                      {a.submitted_at ? formatDate(a.submitted_at) : "—"}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight">Per-question breakdown</h2>
        {questionStats.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm font-bold text-slate-700">This quiz has no questions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questionStats.map(({ question, idx, correctCount, attemptedCount, pct }) => (
              <Card key={question.id} className="overflow-hidden">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Question {idx + 1} · {question.points ?? 1} pt{(question.points ?? 1) === 1 ? "" : "s"}
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">{question.question_text}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        Correct answer: <span className="font-bold text-emerald-700">{question.correct_answer ?? "—"}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {pct !== null ? (
                        <>
                          <div className={`text-lg font-black ${pct >= 75 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-rose-700"}`}>
                            {pct}%
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {correctCount}/{attemptedCount} correct
                          </div>
                        </>
                      ) : (
                        <div className="text-xs font-medium text-slate-400">No attempts</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, icon, color }: { label: string; value: React.ReactNode; icon: React.ReactNode; color: string }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className={`flex h-1.5 items-center justify-center border-x-2 border-t-2 border-slate-900 ${color}`} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-xl font-black text-slate-900">{value}</div>
      </div>
    </div>
  );
}

/**
 * EditQuizModal — edit the quiz's title/description/due_date/publish state.
 * Question-level edits go through the quiz builder, not here.
 */
function EditQuizModal({ quiz }: { quiz: Quiz }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? "");
  const [dueDate, setDueDate] = useState("");
  const [isPublished, setIsPublished] = useState(quiz.is_published);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form when opening
  useMemo(() => {
    if (open) {
      setTitle(quiz.title);
      setDescription(quiz.description ?? "");
      if (quiz.due_date) {
        const d = new Date(quiz.due_date);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDueDate(local);
      } else {
        setDueDate("");
      }
      setIsPublished(quiz.is_published);
      setError(null);
    }
  }, [open, quiz]);

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
      } else if (quiz.due_date) {
        isoDue = null;
      }
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate: isoDue,
          isPublished,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setOpen(false);
      // Refresh the page to reflect new state
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-amber-100 p-1.5 transition-all hover:bg-amber-300"
          aria-label="Edit quiz"
          title="Edit quiz"
        >
          <Pencil className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit quiz</DialogTitle>
          <DialogDescription>
            Update the quiz&apos;s title, description, due date, or publish state.
            For question-level edits, use the quiz builder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quiz-title">Title</Label>
            <Input
              id="edit-quiz-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-quiz-desc">Description (optional)</Label>
            <Textarea
              id="edit-quiz-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-quiz-due">Due date (optional)</Label>
            <Input
              id="edit-quiz-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-[#FDFBF7] px-3 py-2">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="size-4 accent-emerald-500"
            />
            <span className="text-sm font-bold text-slate-900">
              Published (visible to students)
            </span>
          </label>
          {error && (
            <div
              role="alert"
              className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
            >
              {error}
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

/**
 * DeleteQuizButton — destructive action with confirm dialog.
 */
function DeleteQuizButton({ quiz, classId }: { quiz: Quiz; classId: string }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      // Redirect back to the class page
      window.location.href = `/dashboard/classes/${classId}`;
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
          className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7]"
          aria-label="Delete quiz"
          title="Delete quiz"
        >
          <Trash2 className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete quiz?</DialogTitle>
          <DialogDescription>
            This permanently deletes &ldquo;{quiz.title}&rdquo; and all student
            attempts. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
          >
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
