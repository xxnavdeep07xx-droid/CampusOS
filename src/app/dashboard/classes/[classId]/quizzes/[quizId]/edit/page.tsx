import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PencilRuler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tag } from "@/components/brutal/section";
import { QuizQuestionEditor } from "./quiz-question-editor";
import type { Quiz, QuizQuestion, ClassRoom, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/classes/[classId]/quizzes/[quizId]/edit
 *
 * Quiz question editor — lets the teacher add, edit, reorder, and delete
 * individual questions on an existing quiz. The quiz metadata (title,
 * description, due date, publish state) is editable via the Quiz Results
 * page; this page is specifically for question-level edits.
 */
export default async function QuizEditPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Fetch quiz + class + questions in parallel.
  const [{ data: quizRow }, { data: clsRow }, { data: questionRows }] = await Promise.all([
    admin.from("quizzes").select("*").eq("id", quizId).single(),
    admin.from("classes").select("id, name, teacher_id, school_id").eq("id", classId).single(),
    admin
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("position", { ascending: true }),
  ]);

  const quiz = quizRow as Quiz | null;
  const cls = clsRow as { id: string; name: string; teacher_id: string; school_id: string } | null;
  if (!quiz || !cls) notFound();

  // Authorization: caller must be the teacher of this class.
  if (cls.teacher_id !== user.id) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    const profile = profileRow as { role: string; school_id: string | null } | null;
    const isSchoolAdmin =
      (profile?.role === "principal" || profile?.role === "staff") &&
      profile?.school_id === cls.school_id;
    if (!isSchoolAdmin) {
      return (
        <div className="space-y-4">
          <Tag color="bg-rose-400">Access restricted</Tag>
          <p className="text-sm font-medium text-slate-700">
            Only the teacher of this class can edit quiz questions.
          </p>
        </div>
      );
    }
  }

  const questions = (questionRows ?? []) as QuizQuestion[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/quizzes/${quizId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to quiz results
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-rose-300">
            <PencilRuler className="size-3.5" />
            Quiz editor
          </Tag>
          <Tag color="bg-emerald-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {quiz.title}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {questions.length} {questions.length === 1 ? "question" : "questions"} ·
          Edit individual questions below. Changes are saved automatically.
        </p>
        {quiz.description && (
          <p className="mt-1 text-sm text-slate-700">{quiz.description}</p>
        )}
      </div>

      <QuizQuestionEditor
        quizId={quizId}
        classId={classId}
        initialQuestions={questions}
      />
    </div>
  );
}
