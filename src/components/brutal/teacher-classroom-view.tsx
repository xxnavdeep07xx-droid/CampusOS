"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  RefreshCw,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/brutal/section";
import { ResourceCard } from "@/components/brutal/resource-card";
import { AssignmentTeacherRow } from "@/components/brutal/assignment-teacher-row";
import { UploadResourceModal } from "@/components/brutal/upload-resource-modal";
import { CreateAssignmentModal } from "@/components/brutal/create-assignment-modal";
import { SkeletonList, InlineSpinner } from "@/components/brutal/skeleton";
import {
  publicStorageUrl,
  CLASS_MATERIALS_BUCKET,
  formatDate,
} from "@/lib/storage";
import type { ClassRoom, Profile, Resource, Assignment } from "@/lib/types";

/**
 * TeacherClassroomView — client component that renders the teacher's
 * classroom detail page (Resources / Assignments / Students tabs) and
 * re-fetches data when a new resource or assignment is published.
 *
 * Server-rendered HTML is passed in via the `initialResources` /
 * `initialAssignments` / `initialStudents` props so the first paint
 * doesn't require an extra round-trip.
 */
export function TeacherClassroomView({
  cls,
  profile,
  isTeacher,
  isSchoolAdmin,
  initialResources = [],
  initialAssignments = [],
  initialStudents = [],
  migrationMissing = false,
}: {
  cls: ClassRoom;
  profile: Profile;
  isTeacher: boolean;
  isSchoolAdmin: boolean;
  initialResources?: Resource[];
  initialAssignments?: Assignment[];
  initialStudents?: Pick<Profile, "id" | "full_name" | "created_at">[];
  migrationMissing?: boolean;
}) {
  const [resources, setResources] = useState(initialResources);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [students] = useState(initialStudents);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [resRes, assignRes] = await Promise.all([
        fetch(`/api/class-data?classId=${cls.id}&kind=resources`, { cache: "no-store" }),
        fetch(`/api/class-data?classId=${cls.id}&kind=assignments`, { cache: "no-store" }),
      ]);
      if (resRes.ok) {
        const json = await resRes.json();
        setResources(json.items ?? []);
      }
      if (assignRes.ok) {
        const json = await assignRes.json();
        setAssignments(json.items ?? []);
      }
    } catch {
      // ignore — we keep the initial data
    } finally {
      setRefreshing(false);
    }
  }, [cls.id]);

  // If the server flagged that the migration is missing, don't bother
  // auto-refreshing.
  useEffect(() => {
    if (migrationMissing) return;
    // No-op: initial data is already populated by the server component.
  }, [migrationMissing]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/teacher"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to my classes
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color="bg-violet-300">Teacher view</Tag>
          {isSchoolAdmin && !isTeacher && (
            <Tag color="bg-amber-200">Read-only (school admin)</Tag>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition-all hover:bg-amber-100 disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {cls.name}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Created {formatDate(cls.created_at)} · {students.length} enrolled{" "}
          {students.length === 1 ? "student" : "students"}
        </p>
      </div>

      {migrationMissing && (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              Phase 2 migration not applied yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">resources</code>,
              <code className="ml-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">assignments</code>, and
              <code className="ml-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">submissions</code> tables
              don&apos;t exist in your Supabase project yet.
            </p>
            <p className="text-xs font-medium text-slate-600">
              Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0002_classroom_hub.sql</code>
              {" "}via the Supabase SQL editor to enable the Classroom Hub. See{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/README.md</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources">
            <FileText className="size-3.5" />
            Resources ({resources.length})
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <ClipboardList className="size-3.5" />
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="size-3.5" />
            Students ({students.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== RESOURCES TAB ===== */}
        <TabsContent value="resources" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black uppercase tracking-tight">
              {resources.length} {resources.length === 1 ? "resource" : "resources"}
            </h2>
            {isTeacher && <UploadResourceModal classId={cls.id} onPublished={refresh} />}
          </div>

          {refreshing && resources.length === 0 ? (
            <SkeletonList count={3} />
          ) : resources.length === 0 ? (
            <EmptyCard
              icon={<FileText className="size-6 text-slate-900" />}
              title="No resources yet"
              description={
                isTeacher
                  ? "Upload your first resource — lecture slides, reading material, anything students need to download."
                  : "Your teacher hasn't uploaded any resources yet."
              }
            />
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
        </TabsContent>

        {/* ===== ASSIGNMENTS TAB ===== */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black uppercase tracking-tight">
              {assignments.length} {assignments.length === 1 ? "assignment" : "assignments"}
            </h2>
            {isTeacher && <CreateAssignmentModal classId={cls.id} onCreated={refresh} />}
          </div>

          {refreshing && assignments.length === 0 ? (
            <SkeletonList count={2} />
          ) : assignments.length === 0 ? (
            <EmptyCard
              icon={<ClipboardList className="size-6 text-slate-900" />}
              title="No assignments yet"
              description={
                isTeacher
                  ? "Create your first assignment — students will see it in their pending list."
                  : "Your teacher hasn't created any assignments yet."
              }
            />
          ) : (
            <div className="grid gap-3">
              {assignments.map((a) => (
                <AssignmentTeacherRow key={a.id} assignment={a} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== STUDENTS TAB ===== */}
        <TabsContent value="students" className="space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight">
            Enrolled students ({students.length})
          </h2>
          {students.length === 0 ? (
            <EmptyCard
              icon={<Users className="size-6 text-slate-900" />}
              title="No students enrolled yet"
              description="Generate a student invite link from the teacher dashboard to bring students into this class."
              actionHref="/dashboard/teacher"
              actionLabel="Go to teacher dashboard"
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
              <CardContent className="divide-y-2 divide-slate-200">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      {(s.full_name || "?").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-slate-900">
                        {s.full_name || "(no name)"}
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        Joined {formatDate(s.created_at)}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      <GraduationCap className="size-3" />
                      Student
                    </Badge>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          {icon}
        </div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-xs font-medium text-slate-600">{description}</p>
        {actionHref && actionLabel && (
          <Button variant="outline" size="sm" asChild className="mt-4">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
