"use client";

import Link from "next/link";
import { Calendar, Clock, FileText, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Assignment } from "@/lib/types";
import { formatDate, isOverdue, isDueSoon } from "@/lib/storage";

/**
 * AssignmentCard — a brutalist card showing a single assignment.
 *
 * - `dueLabel` is the relative "due in N days" pill — only shown if a due
 *   date is set and the assignment isn't overdue.
 * - `href` makes the entire card a clickable link (used by student view to
 *   navigate to the assignment detail page).
 * - `submissionCount` + `gradedCount` are optional teacher-only stats shown
 *   in the footer.
 */
export function AssignmentCard({
  assignment,
  href,
  submissionCount,
  gradedCount,
  studentSubmitted,
}: {
  assignment: Assignment;
  href?: string;
  /** Teacher-only stat: total submissions for this assignment. */
  submissionCount?: number;
  /** Teacher-only stat: how many are graded. */
  gradedCount?: number;
  /** Student-only flag: whether the current student has submitted. */
  studentSubmitted?: boolean;
}) {
  const overdue = isOverdue(assignment.due_date);
  const dueSoon = isDueSoon(assignment.due_date);

  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all",
        href && "hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]",
      )}
    >
      {/* Accent bar — coral for assignments */}
      <div className="h-1.5 w-full border-x-2 border-t-2 border-slate-900 bg-rose-400" />

      <div className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-rose-400 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <FileText className="size-5 text-slate-900" strokeWidth={2.5} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {overdue && (
              <Badge variant="destructive">Overdue</Badge>
            )}
            {!overdue && dueSoon && (
              <Badge variant="amber">Due soon</Badge>
            )}
            {studentSubmitted && (
              <Badge variant="emerald">Submitted</Badge>
            )}
            {submissionCount !== undefined && (
              <Badge variant="outline">
                {submissionCount} {submissionCount === 1 ? "submission" : "submissions"}
                {gradedCount !== undefined && ` · ${gradedCount} graded`}
              </Badge>
            )}
          </div>
        </div>

        <h3 className="mt-3 text-sm font-bold uppercase tracking-tight text-slate-900">
          {assignment.title}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-xs font-medium text-slate-600">
          {assignment.description || "No description provided."}
        </p>

        <div className="mt-3 flex items-center gap-2 border-t-2 border-slate-200 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {assignment.due_date ? (
            <>
              <Calendar className="size-3.5" />
              <span className={cn(overdue && "text-rose-600")}>
                Due {formatDate(assignment.due_date)}
              </span>
              {dueSoon && !overdue && (
                <>
                  <span>·</span>
                  <Clock className="size-3.5 text-amber-600" />
                  <span className="text-amber-600">Soon</span>
                </>
              )}
            </>
          ) : (
            <span>No due date</span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}

/**
 * MiniAssignmentRow — a more compact horizontal assignment display used in
 * the student "Pending Assignments" list.
 */
export function MiniAssignmentRow({
  assignment,
  href,
  submitted,
}: {
  assignment: Assignment;
  href?: string;
  submitted?: boolean;
}) {
  const overdue = isOverdue(assignment.due_date);
  const dueSoon = isDueSoon(assignment.due_date);

  const body = (
    <div className="flex items-center gap-3 rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-rose-400">
        <Pencil className="size-4 text-slate-900" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-900">
          {assignment.title}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {assignment.due_date
            ? `Due ${formatDate(assignment.due_date)}`
            : "No due date"}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {submitted ? (
          <Badge variant="emerald">Submitted</Badge>
        ) : overdue ? (
          <Badge variant="destructive">Overdue</Badge>
        ) : dueSoon ? (
          <Badge variant="amber">Soon</Badge>
        ) : (
          assignment.due_date && <Badge variant="outline">Pending</Badge>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
