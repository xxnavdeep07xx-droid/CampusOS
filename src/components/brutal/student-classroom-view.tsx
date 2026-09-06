"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  Inbox,
  RefreshCw,
  UserCog,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/brutal/section";
import { ResourceCard } from "@/components/brutal/resource-card";
import { MiniAssignmentRow } from "@/components/brutal/assignment-card";
import {
  publicStorageUrl,
  CLASS_MATERIALS_BUCKET,
  formatDate,
  formatDateTime,
  isOverdue,
  isDueSoon,
} from "@/lib/storage";
import type { ClassRoom, Profile, Resource, Assignment } from "@/lib/types";

/**
 * StudentClassroomView — the student-facing classroom detail page.
 *
 * Renders:
 *   1. Class header with name + teacher name.
 *   2. Resources list (with download buttons).
 *   3. Pending Assignments list (clicking one navigates to the assignment
 *      detail page where they can upload a file).
 */
export function StudentClassroomView({
  cls,
  profile,
  initialResources = [],
  initialAssignments = [],
  initialSubmissions = [],
}: {
  cls: ClassRoom;
  profile: Profile;
  initialResources?: Resource[];
  initialAssignments?: Assignment[];
  initialSubmissions?: Array<{
    id: string;
    assignment_id: string;
    status: "submitted" | "graded";
    grade: number | null;
  }>;
}) {
  const [resources] = useState(initialResources);
  const [assignments] = useState(initialAssignments);
  const [submissions] = useState(initialSubmissions);

  // Build a set of assignment IDs the student has already submitted to.
  const submittedAssignmentIds = new Set(
    submissions.map((s) => s.assignment_id)
  );

  // Sort assignments: pending first (not submitted), then by due date asc.
  const sortedAssignments = [...assignments].sort((a, b) => {
    const aSub = submittedAssignmentIds.has(a.id);
    const bSub = submittedAssignmentIds.has(b.id);
    if (aSub !== bSub) return aSub ? 1 : -1;
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return aDue - bDue;
  });

  const pendingCount = sortedAssignments.filter(
    (a) => !submittedAssignmentIds.has(a.id)
  ).length;
  const submittedCount = sortedAssignments.length - pendingCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/classes"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to my classes
        </Link>
      </div>

      {/* Class header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-rose-300">Student view</Tag>
          <Tag color="bg-sky-300">{cls.name}</Tag>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {cls.name}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          You&apos;re enrolled in this class. Below are the resources your teacher
          has shared and any assignments you still need to submit.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card className="brutal-hover overflow-hidden">
          <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-sky-300" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-sky-300 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <FileText className="size-5 text-slate-900" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Resources
              </span>
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {resources.length}
            </div>
          </CardContent>
        </Card>
        <Card className="brutal-hover overflow-hidden">
          <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-rose-400" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-rose-400 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <ClipboardList className="size-5 text-slate-900" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Pending
              </span>
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card className="brutal-hover overflow-hidden">
          <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-emerald-500 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <GraduationCap className="size-5 text-slate-900" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Submitted
              </span>
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {submittedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resources */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-slate-900" strokeWidth={2.5} />
          <h2 className="text-xl font-black uppercase tracking-tight">
            Resources ({resources.length})
          </h2>
        </div>
        {resources.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-sky-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <Inbox className="size-6 text-slate-900" />
              </div>
              <p className="text-sm font-bold text-slate-900">
                No resources yet
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Your teacher hasn&apos;t uploaded any files for this class.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {resources.map((r) => {
              const downloadUrl = publicStorageUrl(
                CLASS_MATERIALS_BUCKET,
                r.file_path
              );
              return (
                <ResourceCard key={r.id} resource={r} downloadUrl={downloadUrl} />
              );
            })}
          </div>
        )}
      </section>

      {/* Pending Assignments */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-slate-900" strokeWidth={2.5} />
          <h2 className="text-xl font-black uppercase tracking-tight">
            Assignments ({assignments.length})
          </h2>
        </div>
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-rose-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <ClipboardList className="size-6 text-slate-900" />
              </div>
              <p className="text-sm font-bold text-slate-900">
                No assignments yet
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                Your teacher hasn&apos;t created any assignments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {sortedAssignments.map((a) => (
              <MiniAssignmentRow
                key={a.id}
                assignment={a}
                href={`/dashboard/classes/${cls.id}/assignments/${a.id}`}
                submitted={submittedAssignmentIds.has(a.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
