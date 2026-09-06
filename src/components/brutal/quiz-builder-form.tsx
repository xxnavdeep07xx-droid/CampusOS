"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "@/components/brutal/section";
import type { QuestionType } from "@/lib/types";

/**
 * QuizBuilderForm — dynamic form for creating a quiz with N questions.
 *
 * Uses React Hook Form's `useFieldArray` for smooth add/remove of question
 * blocks. Each block has:
 *   - question_text (textarea)
 *   - question_type (select: mcq / short_answer)
 *   - options (dynamic list, only shown for MCQ)
 *   - correct_answer (text for short_answer; select from options for MCQ)
 *   - points (number)
 *
 * Framer Motion AnimatePresence provides smooth enter/exit animations when
 * questions are added or removed.
 */
type QuestionForm = {
  question_text: string;
  question_type: QuestionType;
  options: string[];            // for MCQ
  correct_answer: string;
  points: number;
};

type QuizFormValues = {
  title: string;
  description: string;
  time_limit_minutes: string;   // string for the input, parsed on submit
  due_date: string;             // datetime-local string
  is_published: boolean;
  questions: QuestionForm[];
};

const DEFAULT_QUESTION: QuestionForm = {
  question_text: "",
  question_type: "mcq",
  options: ["", ""],
  correct_answer: "",
  points: 1,
};

export function QuizBuilderForm({
  classId,
  className,
}: {
  classId: string;
  className: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<QuizFormValues>({
    defaultValues: {
      title: "",
      description: "",
      time_limit_minutes: "",
      due_date: "",
      is_published: false,
      questions: [{ ...DEFAULT_QUESTION }],
    },
  });

  const { register, control, handleSubmit, watch, setValue, getValues } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "questions",
  });

  const onSubmit = async (values: QuizFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      // Filter out empty questions.
      const cleanedQuestions = values.questions
        .map((q, i) => ({
          ...q,
          position: i,
          // For MCQ, filter out empty options.
          options: q.question_type === "mcq"
            ? q.options.filter((o) => o.trim() !== "")
            : null,
        }))
        .filter((q) => q.question_text.trim() !== "");

      if (cleanedQuestions.length === 0) {
        setError("Please add at least one question with text.");
        setSubmitting(false);
        return;
      }

      // Validate MCQ: at least 2 options + correct_answer must be one of them.
      for (let i = 0; i < cleanedQuestions.length; i++) {
        const q = cleanedQuestions[i];
        if (q.question_type === "mcq") {
          if (!q.options || q.options.length < 2) {
            setError(`Question ${i + 1}: MCQ needs at least 2 non-empty options.`);
            setSubmitting(false);
            return;
          }
          if (!q.options.includes(q.correct_answer)) {
            setError(`Question ${i + 1}: correct_answer must be one of the options.`);
            setSubmitting(false);
            return;
          }
        } else {
          if (!q.correct_answer.trim()) {
            setError(`Question ${i + 1}: short_answer needs a correct_answer.`);
            setSubmitting(false);
            return;
          }
        }
      }

      // Parse the optional fields.
      const timeLimit = values.time_limit_minutes
        ? parseInt(values.time_limit_minutes, 10)
        : null;
      const dueDate = values.due_date ? new Date(values.due_date).toISOString() : null;

      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: values.title.trim(),
          description: values.description.trim(),
          timeLimitMinutes: timeLimit,
          dueDate,
          isPublished: values.is_published,
          questions: cleanedQuestions,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/classes/${classId}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Quiz metadata */}
      <div className="space-y-4 rounded-2xl border-[3px] border-slate-900 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="h-1.5 w-full border-x-2 border-t-2 border-slate-900 bg-sky-300 -mx-5 -mt-5 mb-1" style={{ width: "calc(100% + 2.5rem)" }} />
        <h2 className="text-lg font-black uppercase tracking-tight">Quiz details</h2>

        <div className="space-y-2">
          <Label htmlFor="quiz-title">Title</Label>
          <Input
            id="quiz-title"
            type="text"
            placeholder="e.g. Week 5 — Quadratic Equations Quiz"
            {...register("title", { required: true, minLength: 2 })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quiz-desc">Description (optional)</Label>
          <Textarea
            id="quiz-desc"
            rows={2}
            placeholder="What does this quiz cover? Any instructions for students?"
            {...register("description")}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="quiz-time">Time limit (minutes)</Label>
            <Input
              id="quiz-time"
              type="number"
              min={1}
              max={300}
              placeholder="No limit"
              {...register("time_limit_minutes")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-due">Due date (optional)</Label>
            <Input
              id="quiz-due"
              type="datetime-local"
              {...register("due_date")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-published">Publish immediately?</Label>
            <button
              type="button"
              id="quiz-published"
              onClick={() => setValue("is_published", !getValues("is_published"))}
              className={`flex h-11 w-full items-center justify-between rounded-xl border-2 border-slate-900 px-4 text-sm font-bold uppercase tracking-wider transition-all ${
                watch("is_published")
                  ? "bg-emerald-500 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(5,150,105,1)]"
                  : "bg-white text-slate-900 hover:bg-amber-100"
              }`}
            >
              {watch("is_published") ? "Published ✓" : "Save as draft"}
            </button>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">
            Questions ({fields.length})
          </h2>
          <Button
            type="button"
            variant="sky"
            size="sm"
            onClick={() => append({ ...DEFAULT_QUESTION })}
          >
            <Plus className="size-4" />
            Add question
          </Button>
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <QuestionBlock
                index={index}
                register={register}
                control={control}
                watch={watch}
                setValue={setValue}
                getValues={getValues}
                onRemove={() => {
                  if (fields.length === 1) return;
                  remove(index);
                }}
                onMoveUp={() => index > 0 && move(index, index - 1)}
                onMoveDown={() => index < fields.length - 1 && move(index, index + 1)}
                canRemove={fields.length > 1}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Submit */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]"
        >
          <CheckCircle2 className="mr-2 inline size-4" />
          Quiz saved! Redirecting…
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <Link
          href={`/dashboard/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Cancel
        </Link>
        <Button
          type="submit"
          variant="emerald"
          size="lg"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving quiz…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save quiz ({fields.length} {fields.length === 1 ? "question" : "questions"})
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ============================================================
// Single question block
// ============================================================

import { Control, UseFormGetValues, UseFormRegisterReturn, UseFormSetValue, UseFormWatch } from "react-hook-form";

function QuestionBlock({
  index,
  register,
  control,
  watch,
  setValue,
  getValues,
  onRemove,
  onMoveUp,
  onMoveDown,
  canRemove,
  isFirst,
  isLast,
}: {
  index: number;
  register: (name: string, opts?: Record<string, unknown>) => UseFormRegisterReturn;
  control: Control<QuizFormValues>;
  watch: UseFormWatch<QuizFormValues>;
  setValue: UseFormSetValue<QuizFormValues>;
  getValues: UseFormGetValues<QuizFormValues>;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const baseName = `questions.${index}` as const;
  const qType = watch(`${baseName}.question_type`);
  const options = watch(`${baseName}.options`) ?? [];

  function addOption() {
    const current = getValues(`${baseName}.options`) ?? [];
    setValue(`${baseName}.options`, [...current, ""]);
  }
  function removeOption(i: number) {
    const current = getValues(`${baseName}.options`) ?? [];
    if (current.length <= 2) return;
    setValue(
      `${baseName}.options`,
      current.filter((_, idx) => idx !== i)
    );
    // If the correct_answer was the removed option, clear it.
    const correct = getValues(`${baseName}.correct_answer`);
    if (correct === current[i]) setValue(`${baseName}.correct_answer`, "");
  }
  function updateOption(i: number, val: string) {
    const current = getValues(`${baseName}.options`) ?? [];
    const next = [...current];
    next[i] = val;
    setValue(`${baseName}.options`, next);
    // If the correct_answer was the old value of this option, update it.
    const correct = getValues(`${baseName}.correct_answer`);
    if (correct === current[i]) setValue(`${baseName}.correct_answer`, val);
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 px-3 py-2 text-[#FDFBF7]">
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-slate-400" />
          <span className="text-xs font-black uppercase tracking-wider">
            Question {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded-md border-2 border-[#FDFBF7]/30 bg-slate-800 p-1 transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded-md border-2 border-[#FDFBF7]/30 bg-slate-800 p-1 transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className="rounded-md border-2 border-[#FDFBF7]/30 bg-rose-500 p-1 transition-all hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Delete question"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <Label htmlFor={`${baseName}.question_text`}>Question text</Label>
          <Textarea
            id={`${baseName}.question_text`}
            rows={2}
            placeholder="e.g. What is the discriminant of ax² + bx + c = 0?"
            {...register(`${baseName}.question_text`, { required: true })}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${baseName}.question_type`}>Type</Label>
            <Select
              value={qType}
              onValueChange={(v) => setValue(`${baseName}.question_type`, v as QuestionType)}
            >
              <SelectTrigger id={`${baseName}.question_type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple choice</SelectItem>
                <SelectItem value="short_answer">Short answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${baseName}.points`}>Points</Label>
            <Input
              id={`${baseName}.points`}
              type="number"
              min={0}
              max={100}
              {...register(`${baseName}.points`, { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>Hint</Label>
            <div className="flex h-11 items-center rounded-xl border-2 border-slate-200 bg-[#FDFBF7] px-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              {qType === "mcq" ? "Pick correct option" : "Exact match (case-insensitive)"}
            </div>
          </div>
        </div>

        {/* MCQ options */}
        {qType === "mcq" && (
          <div className="space-y-2 rounded-lg border-2 border-slate-200 bg-[#FDFBF7] p-3">
            <div className="flex items-center justify-between">
              <Label>Options (mark the correct one)</Label>
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-sky-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]"
              >
                <Plus className="size-3" />
                Add option
              </button>
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => {
                const correct = watch(`${baseName}.correct_answer`) === opt;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => opt.trim() && setValue(`${baseName}.correct_answer`, opt)}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 transition-all ${
                        correct
                          ? "bg-emerald-500 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(5,150,105,1)]"
                          : "bg-white text-slate-400 hover:bg-amber-100"
                      }`}
                      aria-label={correct ? "Correct answer" : "Mark as correct"}
                      title={correct ? "Correct answer ✓" : "Mark as correct"}
                    >
                      {correct ? "✓" : String.fromCharCode(65 + i)}
                    </button>
                    <Input
                      type="text"
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className={correct ? "border-emerald-500" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={options.length <= 2}
                      className="rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7] disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Remove option"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Short answer correct_answer */}
        {qType === "short_answer" && (
          <div className="space-y-2">
            <Label htmlFor={`${baseName}.correct_answer`}>Correct answer</Label>
            <Input
              id={`${baseName}.correct_answer`}
              type="text"
              placeholder="e.g. b² - 4ac"
              {...register(`${baseName}.correct_answer`, { required: qType === "short_answer" })}
              required={qType === "short_answer"}
            />
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Matched case-insensitively, trimmed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
