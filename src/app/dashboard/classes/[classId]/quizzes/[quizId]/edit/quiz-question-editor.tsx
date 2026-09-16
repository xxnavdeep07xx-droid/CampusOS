"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuizQuestion, QuestionType } from "@/lib/types";

/**
 * QuizQuestionEditor
 *
 * Renders a list of quiz questions. Each question is an expandable card that
 * can be edited inline (question text, type, options, correct answer, points).
 *
 * Supports:
 *   - Inline edit + auto-save (on blur or Save button click)
 *   - Add new question (appends to end of list)
 *   - Delete question (with confirm)
 *   - Reorder questions (move up/down — sends new position via PATCH)
 */
export function QuizQuestionEditor({
  quizId,
  classId: _classId,
  initialQuestions,
}: {
  quizId: string;
  classId: string;
  initialQuestions: QuizQuestion[];
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [addingNew, setAddingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleQuestionUpdated(updated: QuizQuestion) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  }

  function handleQuestionDeleted(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function handleQuestionAdded(q: QuizQuestion) {
    setQuestions((prev) => [...prev, q]);
    setAddingNew(false);
  }

  async function handleReorder(question: QuizQuestion, direction: "up" | "down") {
    const idx = questions.findIndex((q) => q.id === question.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;

    const other = questions[swapIdx];
    // Optimistic swap
    const reordered = [...questions];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    // Update positions
    reordered.forEach((q, i) => {
      if (q.position !== i) {
        q.position = i;
      }
    });
    setQuestions(reordered);

    // Send PATCH for both swapped questions
    try {
      await Promise.all([
        fetch(`/api/quiz-questions/${question.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: idx }),
        }),
        fetch(`/api/quiz-questions/${other.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: swapIdx }),
        }),
      ]);
    } catch (err) {
      console.error("Reorder failed:", err);
      // Revert on failure
      setQuestions(initialQuestions);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-tight">
          Questions ({questions.length})
        </h2>
        <Button
          type="button"
          variant="coral"
          size="sm"
          onClick={() => setAddingNew(true)}
          disabled={addingNew}
        >
          <Plus className="size-4" />
          Add question
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {questions.length === 0 && !addingNew ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-bold text-slate-900">No questions yet</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Click &ldquo;Add question&rdquo; to create the first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <QuestionEditorCard
              key={q.id}
              question={q}
              index={idx}
              total={questions.length}
              onUpdated={handleQuestionUpdated}
              onDeleted={handleQuestionDeleted}
              onMoveUp={() => handleReorder(q, "up")}
              onMoveDown={() => handleReorder(q, "down")}
            />
          ))}
          {addingNew && (
            <NewQuestionCard
              quizId={quizId}
              onCreated={handleQuestionAdded}
              onCancel={() => setAddingNew(false)}
              onError={setError}
            />
          )}
        </div>
      )}
    </div>
  );
}

function QuestionEditorCard({
  question,
  index,
  total,
  onUpdated,
  onDeleted,
  onMoveUp,
  onMoveDown,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  onUpdated: (q: QuizQuestion) => void;
  onDeleted: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [questionText, setQuestionText] = useState(question.question_text);
  const [questionType, setQuestionType] = useState<QuestionType>(question.question_type);
  const [options, setOptions] = useState<string[]>(question.options ?? ["", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer);
  const [points, setPoints] = useState(String(question.points));
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dirty =
    questionText !== question.question_text ||
    questionType !== question.question_type ||
    JSON.stringify(options) !== JSON.stringify(question.options ?? ["", ""]) ||
    correctAnswer !== question.correct_answer ||
    points !== String(question.points);

  async function handleSave() {
    if (!questionText.trim()) {
      setError("Question text cannot be empty.");
      return;
    }
    if (questionType === "mcq") {
      const nonEmptyOpts = options.filter((o) => o.trim() !== "");
      if (nonEmptyOpts.length < 2) {
        setError("MCQ needs at least 2 options.");
        return;
      }
      if (!nonEmptyOpts.includes(correctAnswer)) {
        setError("Correct answer must be one of the options.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz-questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText.trim(),
          questionType,
          options: questionType === "mcq" ? options : undefined,
          correctAnswer: correctAnswer.trim(),
          points: Number(points),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      onUpdated(json.question as QuizQuestion);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    try {
      const res = await fetch(`/api/quiz-questions/${question.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      onDeleted(question.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg border-2 border-slate-900 bg-rose-300 text-xs font-black text-slate-900">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">
              {questionText || "(empty question)"}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>{question.points} pt{question.points === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{question.question_type === "mcq" ? "MCQ" : "Short answer"}</span>
              {dirty && (
                <span className="text-amber-700">· unsaved</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded border-2 border-slate-300 bg-white p-1 transition-all hover:bg-slate-100 disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded border-2 border-slate-300 bg-white p-1 transition-all hover:bg-slate-100 disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded border-2 border-slate-900 bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-300"
          >
            {expanded ? "Hide" : "Edit"}
          </button>
        </div>
      </div>

      {expanded && (
        <CardContent className="space-y-3 py-3">
          <div className="space-y-1.5">
            <Label htmlFor={`q-text-${question.id}`} className="text-[10px] font-bold uppercase tracking-wider">
              Question text
            </Label>
            <Textarea
              id={`q-text-${question.id}`}
              rows={2}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider">Type</Label>
              <Select
                value={questionType}
                onValueChange={(v) => {
                  setQuestionType(v as QuestionType);
                  if (v === "short_answer") {
                    setCorrectAnswer("");
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple choice</SelectItem>
                  <SelectItem value="short_answer">Short answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`q-points-${question.id}`} className="text-[10px] font-bold uppercase tracking-wider">
                Points
              </Label>
              <Input
                id={`q-points-${question.id}`}
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                disabled={saving}
                className="h-9"
              />
            </div>
          </div>

          {questionType === "mcq" && (
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider">
                Options (select the correct one)
              </Label>
              <div className="space-y-1.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(opt)}
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 transition-all",
                        correctAnswer === opt && opt.trim()
                          ? "bg-emerald-500 text-[#FDFBF7]"
                          : "bg-white hover:bg-slate-100"
                      )}
                      title="Mark as correct answer"
                    >
                      {correctAnswer === opt && opt.trim() && (
                        <Check className="size-3" strokeWidth={3} />
                      )}
                    </button>
                    <Input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                        if (correctAnswer === opt) {
                          setCorrectAnswer(e.target.value);
                        }
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="h-9 flex-1"
                      disabled={saving}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOptions(options.filter((_, idx) => idx !== i));
                          if (correctAnswer === opt) setCorrectAnswer("");
                        }}
                        className="rounded border-2 border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                        aria-label="Remove option"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions([...options, ""])}
                disabled={saving}
              >
                <Plus className="size-3" />
                Add option
              </Button>
            </div>
          )}

          {questionType === "short_answer" && (
            <div className="space-y-1.5">
              <Label htmlFor={`q-answer-${question.id}`} className="text-[10px] font-bold uppercase tracking-wider">
                Correct answer
              </Label>
              <Input
                id={`q-answer-${question.id}`}
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="The expected answer (case-insensitive match)"
                disabled={saving}
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t-2 border-slate-100 pt-2">
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-700 hover:underline"
              >
                <Trash2 className="size-3" />
                Delete question
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-700">Delete?</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                  Yes, delete
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              {savedFlash && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <Check className="size-3" /> Saved!
                </span>
              )}
              <Button
                type="button"
                variant="emerald"
                size="sm"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function NewQuestionCard({
  quizId,
  onCreated,
  onCancel,
  onError,
}: {
  quizId: string;
  onCreated: (q: QuizQuestion) => void;
  onCancel: () => void;
  onError: (err: string) => void;
}) {
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [points, setPoints] = useState("1");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!questionText.trim()) {
      onError("Question text is required.");
      return;
    }
    if (questionType === "mcq") {
      const nonEmptyOpts = options.filter((o) => o.trim() !== "");
      if (nonEmptyOpts.length < 2) {
        onError("MCQ needs at least 2 options.");
        return;
      }
      if (!nonEmptyOpts.includes(correctAnswer)) {
        onError("Select the correct answer.");
        return;
      }
    } else {
      if (!correctAnswer.trim()) {
        onError("Correct answer is required.");
        return;
      }
    }

    setSaving(true);
    onError("");
    try {
      const res = await fetch("/api/quiz-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          questionText: questionText.trim(),
          questionType,
          options: questionType === "mcq" ? options : undefined,
          correctAnswer: correctAnswer.trim(),
          points: Number(points),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      onCreated(json.question as QuizQuestion);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden border-2 border-emerald-500">
      <div className="flex items-center justify-between border-b-2 border-emerald-200 bg-emerald-50 px-4 py-2">
        <Badge variant="emerald">New question</Badge>
      </div>
      <CardContent className="space-y-3 py-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider">Question text</Label>
          <Textarea
            rows={2}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="e.g. What is the capital of France?"
            disabled={saving}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider">Type</Label>
            <Select
              value={questionType}
              onValueChange={(v) => {
                setQuestionType(v as QuestionType);
                setCorrectAnswer("");
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple choice</SelectItem>
                <SelectItem value="short_answer">Short answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider">Points</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              disabled={saving}
              className="h-9"
            />
          </div>
        </div>
        {questionType === "mcq" && (
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-wider">Options (click circle to mark correct)</Label>
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(opt)}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 transition-all",
                      correctAnswer === opt && opt.trim()
                        ? "bg-emerald-500 text-[#FDFBF7]"
                        : "bg-white hover:bg-slate-100"
                    )}
                  >
                    {correctAnswer === opt && opt.trim() && <Check className="size-3" strokeWidth={3} />}
                  </button>
                  <Input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                      if (correctAnswer === opt) setCorrectAnswer(e.target.value);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="h-9 flex-1"
                    disabled={saving}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOptions(options.filter((_, idx) => idx !== i));
                        if (correctAnswer === opt) setCorrectAnswer("");
                      }}
                      className="rounded border-2 border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ""])} disabled={saving}>
              <Plus className="size-3" />
              Add option
            </Button>
          </div>
        )}
        {questionType === "short_answer" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider">Correct answer</Label>
            <Input
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              placeholder="The expected answer (case-insensitive match)"
              disabled={saving}
            />
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t-2 border-slate-100 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="emerald" size="sm" onClick={handleCreate} disabled={saving || !questionText.trim()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add question
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
