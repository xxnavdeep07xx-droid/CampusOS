import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/brutal/section";
import { SubmitAssignmentForm } from "@/components/brutal/submit-assignment-form";
import type { ClassRoom, Profile, Assignment, Submission } from "@/lib/types";
import { formatDate, formatDateTime, isOverdue, isDueSoon } from "@/lib/storage";

/**
 * Student assignment detail page at:
 *   /dashboard/classes/[classId]/assignments/[assignmentId]
 *
 * Server component. Fetches the assignment + the student's existing
 * submission (if any), then renders:
 *   - If no submission yet → "Submit your work" form (upload a file to
 *     student_submissions + POST /api/submissions).
 *   - If submission exists and is graded → graded state with grade + feedback.
 *   - If submission exists but not graded → "Submitted, awaiting grading".
 */
export default async function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ classId: string; assignmentId: string }>;
}) {
  const { classId, assignmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + class + assignment in parallel.
  const [{ data: profileRow }, { data: classRow }, { data: assignmentRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
    supabase.from("assignments").select("*").eq("id", assignmentId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  const assignment = assignmentRow as Assignment | null;

  if (!cls || !assignment) notFound();

  // Authorization: student must be enrolled in this class AND the assignment
  // must belong to the same class.
  if (!profile || profile.role !== "student") {
    redirect(`/dashboard/classes/${classId}`);
  }
  if (profile.school_id !== cls.school_id) notFound();
  if (profile.class_id !== classId) {
    redirect("/dashboard/classes");
  }
  if (assignment.class_id !== classId) notFound();

  // Fetch the student's existing submission for this assignment (if any).
  const { data: existingSub } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id)
    .maybeSingle();
  const submission = existingSub as Submission | null;

  const overdue = isOverdue(assignment.due_date);
  const dueSoon = isDueSoon(assignment.due_date);
  const isGraded = submission?.status === "graded" || submission?.grade != null;

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
          <Tag color="bg-rose-300">Assignment</Tag>
          {overdue && <Badge variant="destructive">Overdue</Badge>}
          {!overdue && dueSoon && <Badge variant="amber">Due soon</Badge>}
          {submission && !isGraded && <Badge variant="sky">Submitted</Badge>}
          {isGraded && <Badge variant="emerald">Graded · {submission!.grade}/100</Badge>}
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {assignment.title}
        </h1>
        {assignment.due_date && (
          <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Calendar className="size-4" />
            <span className={overdue ? "text-rose-600" : ""}>
              Due {formatDateTime(assignment.due_date)}
            </span>
            {dueSoon && !overdue && (
              <>
                <Clock className="ml-2 size-4 text-amber-600" />
                <span className="text-amber-600">Soon</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* Assignment description */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-rose-400" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            Instructions
          </CardTitle>
          <CardDescription>Read carefully before submitting.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm font-medium text-slate-700">
            {assignment.description || "No description provided by your teacher."}
          </p>
        </CardContent>
      </Card>

      {/* Submission section */}
      {submission && isGraded ? (
        // ===== GRADED =====
        <Card className="overflow-hidden border-emerald-500 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-emerald-500 bg-emerald-500" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" />
              Graded — {submission.grade}/100
            </CardTitle>
            <CardDescription>
              Submitted {formatDateTime(submission.created_at)}
              {submission.updated_at && submission.updated_at !== submission.created_at && (
                <> · Updated {formatDateTime(submission.updated_at)}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Your file
              </div>
              <code className="mt-1 block break-all rounded-lg border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                {submission.file_path.split("/").pop() ?? submission.file_path}
              </code>
            </div>
            {submission.feedback && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Teacher feedback
                </div>
                <p className="mt-1 rounded-lg border-2 border-slate-900 bg-amber-50 px-3 py-2 text-sm font-medium text-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  {submission.feedback}
                </p>
              </div>
            )}
            <p className="text-xs font-medium text-slate-600">
              You can re-submit a new file if needed — it will overwrite your previous submission.
            </p>
            <SubmitAssignmentForm
              classId={classId}
              assignmentId={assignmentId}
              existingSubmission={submission}
            />
          </CardContent>
        </Card>
      ) : submission ? (
        // ===== SUBMITTED, AWAITING GRADING =====
        <Card className="overflow-hidden border-sky-400 shadow-[4px_4px_0px_0px_rgba(56,189,248,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-sky-400 bg-sky-300" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sky-700">
              <CheckCircle2 className="size-5" />
              Submitted — awaiting grading
            </CardTitle>
            <CardDescription>
              Submitted {formatDateTime(submission.created_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Your file
              </div>
              <code className="mt-1 block break-all rounded-lg border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                {submission.file_path.split("/").pop() ?? submission.file_path}
              </code>
            </div>
            <p className="text-xs font-medium text-slate-600">
              Your teacher hasn&apos;t graded this yet. You can re-submit a new file
              if you need to update your work.
            </p>
            <SubmitAssignmentForm
              classId={classId}
              assignmentId={assignmentId}
              existingSubmission={submission}
            />
          </CardContent>
        </Card>
      ) : (
        // ===== NOT YET SUBMITTED =====
        <Card className="overflow-hidden">
          <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-violet-400" />
          <CardHeader>
            <CardTitle>Submit your work</CardTitle>
            <CardDescription>
              Upload a single file. Supported types: any. Max 25&nbsp;MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubmitAssignmentForm
              classId={classId}
              assignmentId={assignmentId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
