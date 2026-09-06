"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradeSubmissionsList } from "@/components/brutal/grade-submissions-list";
import type { Assignment } from "@/lib/types";
import { formatDate, isOverdue } from "@/lib/storage";

/**
 * AssignmentTeacherRow — a single assignment row in the teacher's
 * Assignments tab. Includes a "Grade submissions" expandable section.
 */
export function AssignmentTeacherRow({ assignment }: { assignment: Assignment }) {
  const [expanded, setExpanded] = useState(false);

  const overdue = isOverdue(assignment.due_date);

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className="h-1.5 w-full border-x-2 border-t-2 border-slate-900 bg-rose-400" />
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold uppercase tracking-tight text-slate-900">
              {assignment.title}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {assignment.description || "No description provided."}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Created {formatDate(assignment.created_at)}</span>
              {assignment.due_date && (
                <>
                  <span>·</span>
                  <span className={overdue ? "text-rose-600" : ""}>
                    Due {formatDate(assignment.due_date)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-4" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" />
                  Grade submissions
                </>
              )}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t-2 border-slate-200 pt-4">
            <GradeSubmissionsList assignmentId={assignment.id} />
          </div>
        )}
      </div>
    </div>
  );
}
