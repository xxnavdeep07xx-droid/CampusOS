"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/brutal/section";
import type { Quiz, QuizQuestion, QuizAttempt } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * QuizTaker — the student-facing quiz interface.
 *
 * Features:
 *   - Chunky countdown timer fixed at the top (bg-amber-300, monospace,
 *     bold). Auto-submits when it hits 00:00.
 *   - Questions displayed as heavily bordered cards. MCQ options are
 *     selectable cards that turn emerald-400 when chosen.
 *   - Final Submit button at the bottom + a sticky submit bar.
 *   - On submit: PATCH /api/quiz-attempts/[id] with { answers, submit: true }.
 *     The server computes the score (so the client can't cheat).
 *
 * If the attempt is already completed (the API returns `alreadyCompleted:
 * true`), we render the score + a "back to dashboard" link instead.
 */
export function QuizTaker({
  quiz,
  questions,
  attempt,
  className,
  alreadyCompleted,
}: {
  quiz: Quiz;
  questions: QuizQuestion[]; // correct_answer stripped for students
  attempt: QuizAttempt;
  className: string;
  alreadyCompleted?: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(
    (attempt.answers as Record<string, string>) ?? {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    score: number;
    maxScore: number;
  } | null>(alreadyCompleted ? {
    score: attempt.score,
    maxScore: attempt.max_score,
  } : null);

  // Countdown timer.
  const totalSeconds = quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null;
  const startedAt = new Date(attempt.started_at).getTime();
  const [remaining, setRemaining] = useState<number>(() => {
    if (!totalSeconds) return Infinity;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, totalSeconds - elapsed);
  });
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/quiz-attempts/${attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, submit: true }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Failed (HTTP ${res.status})`);
        }
        const submitted = json.attempt as QuizAttempt;
        setSubmittedResult({ score: submitted.score, maxScore: submitted.max_score });
        if (auto) {
          setError("⏰ Time's up — your quiz was auto-submitted.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [answers, attempt.id, submitting]
  );

  // Tick the timer once per second.
  useEffect(() => {
    if (totalSeconds == null || submittedResult) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r === Infinity) return r;
        const next = Math.max(0, r - 1);
        if (next === 0 && remainingRef.current > 0) {
          // Auto-submit when the timer hits zero.
          handleSubmit(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [totalSeconds, submittedResult, handleSubmit]);

  // ----- Helpers -----
  function formatTime(s: number): string {
    if (s === Infinity) return "∞";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function answerQuestion(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;
  const allAnswered = answeredCount === questions.length;
  const lowTime = remaining !== Infinity && remaining <= 30;

  // ----- Submitted view -----
  if (submittedResult) {
    const pct = submittedResult.maxScore > 0
      ? Math.round((submittedResult.score / submittedResult.maxScore) * 100)
      : 0;
    const letter = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
    const accent =
      pct >= 90 ? "bg-emerald-500 text-[#FDFBF7] border-emerald-600"
      : pct >= 75 ? "bg-amber-400 text-slate-900 border-amber-500"
      : pct >= 50 ? "bg-sky-300 text-slate-900 border-sky-400"
      : "bg-rose-500 text-[#FDFBF7] border-rose-600";

    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className={`h-2 w-full border-x-2 border-t-2 border-slate-900 ${accent.split(" ")[0]}`} />
          <CardContent className="space-y-4 py-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" strokeWidth={2.5} />
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Quiz submitted!
            </h2>
            <div className={`mx-auto inline-flex items-center justify-center rounded-2xl border-[3px] px-6 py-3 ${accent} shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]`}>
              <span className="font-mono text-3xl font-black">
                {submittedResult.score} / {submittedResult.maxScore}
              </span>
              <span className="ml-2 text-2xl font-black">·</span>
              <span className="ml-2 text-3xl font-black">{pct}%</span>
              <span className="ml-3 rounded-lg border-2 border-slate-900 bg-white px-2 py-0.5 text-base font-black text-slate-900">
                {letter}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">
              {answeredCount} of {questions.length} questions answered.
            </p>
            {error && (
              <p className="text-xs font-bold text-amber-700">{error}</p>
            )}
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/dashboard/grades">View my grades</Link>
              </Button>
              <Button variant="emerald" asChild>
                <Link href={`/dashboard/classes/${quiz.class_id}`}>Back to class</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Active quiz view -----
  return (
    <div className="space-y-4 pb-24">
      {/* Sticky timer bar */}
      <div className="sticky top-0 z-30">
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-2 border-slate-900 px-4 py-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]",
            lowTime ? "bg-rose-400" : "bg-amber-300"
          )}
        >
          <Link
            href={`/dashboard/classes/${quiz.class_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 hover:underline"
          >
            <ArrowLeft className="size-4" />
            Exit
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-900">
              {className}
            </span>
          </div>
          {totalSeconds != null ? (
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-slate-900" strokeWidth={3} />
              <span className="font-mono text-xl font-black tabular-nums text-slate-900">
                {formatTime(remaining)}
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-900">
              No time limit
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Tag color="bg-sky-300">{quiz.title}</Tag>
        {quiz.description && (
          <p className="text-sm font-medium text-slate-600">{quiz.description}</p>
        )}
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {questions.length} {questions.length === 1 ? "question" : "questions"} ·
          {" "}{answeredCount} answered
        </p>
      </div>

      {/* Questions */}
      <AnimatePresence mode="popLayout" initial={false}>
        {questions.map((q, i) => {
          const chosen = answers[q.id];
          return (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 px-4 py-2 text-[#FDFBF7]">
                  <span className="text-xs font-black uppercase tracking-wider">
                    Question {i + 1} of {questions.length}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    {q.points} {q.points === 1 ? "pt" : "pts"}
                  </span>
                </div>
                <CardContent className="space-y-4 py-4">
                  <p className="text-base font-bold text-slate-900">
                    {q.question_text}
                  </p>

                  {q.question_type === "mcq" ? (
                    <div className="grid gap-2">
                      {q.options?.map((opt, idx) => {
                        const selected = chosen === opt;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => answerQuestion(q.id, opt)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border-2 border-slate-900 px-4 py-3 text-left text-sm font-bold transition-all",
                              selected
                                ? "bg-emerald-400 text-slate-900 shadow-[3px_3px_0px_0px_rgba(5,150,105,1)] translate-x-[-1px] translate-y-[-1px]"
                                : "bg-white text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-amber-100"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 text-xs font-black",
                                selected ? "bg-slate-900 text-[#FDFBF7]" : "bg-amber-200 text-slate-900"
                              )}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {selected && <CheckCircle2 className="size-4 text-slate-900" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={chosen ?? ""}
                        onChange={(e) => answerQuestion(q.id, e.target.value)}
                        rows={3}
                        placeholder="Type your answer here…"
                        className="w-full rounded-xl border-2 border-slate-900 bg-white px-4 py-3 text-sm font-medium shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] focus:translate-x-[-2px] focus:translate-y-[-2px]"
                      />
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Matched case-insensitively against the correct answer.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl px-4 pb-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
            {allAnswered ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-600" />
                All answered
              </>
            ) : (
              <>
                <AlertTriangle className="size-4 text-amber-600" />
                {answeredCount} / {questions.length} answered
              </>
            )}
          </div>
          <Button
            type="button"
            variant="emerald"
            size="lg"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="size-4" />
                Submit quiz
              </>
            )}
          </Button>
        </div>
      </div>

      {error && !submittedResult && (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
