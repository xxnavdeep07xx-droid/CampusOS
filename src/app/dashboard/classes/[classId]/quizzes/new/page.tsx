import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PencilRuler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { QuizBuilderForm } from "@/components/brutal/quiz-builder-form";
import type { ClassRoom, Profile } from "@/lib/types";

/**
 * Quiz Builder page at /dashboard/classes/[classId]/quizzes/new.
 *
 * Server component. Authorizes the caller (must be the teacher of this
 * class or a school admin), then renders the QuizBuilderForm client
 * component.
 */
export default async function NewQuizPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow }, { data: classRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  if (!cls) notFound();
  if (!profile || profile.school_id !== cls.school_id) notFound();

  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin = profile.role === "principal" || profile.role === "staff";
  if (!isTeacher && !isSchoolAdmin) {
    redirect(`/dashboard/classes/${classId}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to {cls.name}
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-sky-300">
            <PencilRuler className="size-3.5" />
            Quiz builder
          </Tag>
          <Tag color="bg-emerald-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Create a new quiz
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Build questions one at a time. MCQ options can be marked as correct with
          a single click. Save as draft or publish immediately — students will see
          it on their dashboard the moment you publish.
        </p>
      </div>

      <QuizBuilderForm classId={classId} className={cls.name} />
    </div>
  );
}
