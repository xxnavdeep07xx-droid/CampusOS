import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import type { ClassRoom, Profile } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * /dashboard/classes — "My Classes" grid.
 *
 * - Teachers see their own classes (the ones they teach).
 * - Students see the class they're enrolled in (typically just 1).
 * - Principals / staff see all classes in their school.
 *
 * Every card is a link to /dashboard/classes/[classId] — the role-aware
 * detail page that renders the appropriate view (TeacherClassroomView
 * or StudentClassroomView).
 */
export default async function ClassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();
  const profile = profileRow as Profile | null;

  // For students: filter to only their enrolled class.
  // For teachers: filter to only their classes.
  // For principals/staff: all classes in their school.
  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("school_id", profile?.school_id ?? "")
    .order("created_at", { ascending: false });

  if (profile?.role === "teacher") {
    classQuery = classQuery.eq("teacher_id", user!.id);
  } else if (profile?.role === "student") {
    if (profile.class_id) {
      classQuery = classQuery.eq("id", profile.class_id);
    } else {
      // Student has no class_id — show empty state.
      classQuery = classQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data: classRows, error: classErr } = await classQuery;
  const classes = (classRows ?? []) as ClassRoom[];

  // Detect whether the Phase 2 migration is missing (class_id column doesn't
  // exist yet) — students with no class_id will get a friendly hint.
  const profileMissingClassId =
    profile?.role === "student" && !profile.class_id;

  // Fetch teacher names + student counts in parallel.
  const teacherIds = Array.from(new Set(classes.map((c) => c.teacher_id)));
  const classIds = classes.map((c) => c.id);

  const [teacherRows, studentCountByClass] = await Promise.all([
    teacherIds.length === 0
      ? Promise.resolve([])
      : supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds)
          .then(({ data }) => data ?? []),
    Promise.all(
      classIds.map((cid) =>
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("class_id", cid)
          .eq("role", "student")
          .then(({ count }) => [cid, count ?? 0] as const)
      )
    ).then((entries) => Object.fromEntries(entries)),
  ]);

  const teacherNameById: Record<string, string> = {};
  for (const t of teacherRows as { id: string; full_name: string }[]) {
    teacherNameById[t.id] = t.full_name || "Unnamed";
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Tag color="bg-amber-300">Classes</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {profile?.role === "teacher"
            ? "Your classes"
            : profile?.role === "student"
            ? "My classes"
            : "All classes"}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {classes.length} {classes.length === 1 ? "class" : "classes"}
          {profile?.role === "student" && " · click to view resources & assignments"}
        </p>
      </div>

      {profileMissingClassId && (
        <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
          <CardContent className="space-y-2 py-5">
            <h3 className="text-base font-black uppercase tracking-tight text-amber-700">
              You&apos;re not enrolled in a class yet
            </h3>
            <p className="text-sm font-medium text-slate-700">
              Ask your teacher to send you a fresh student invite link. Once
              you accept it, your class will appear here.
            </p>
            <p className="text-xs font-medium text-slate-600">
              (Phase 1 students who registered before the Phase 2 migration
              need a re-invite to link to a class — see{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/README.md</code>.)
            </p>
          </CardContent>
        </Card>
      )}

      {classErr && (
        <Card>
          <CardContent className="py-5 text-sm font-medium text-rose-700">
            Error loading classes: {classErr.message}
          </CardContent>
        </Card>
      )}

      {classes.length === 0 && !profileMissingClassId ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Building2 className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">No classes yet.</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {profile?.role === "teacher"
                ? "Create your first class from the teacher dashboard."
                : profile?.role === "student"
                ? "Your teacher hasn't enrolled you in a class yet."
                : "Teachers create classes — once they do, they'll show up here."}
            </p>
            {profile?.role === "teacher" && (
              <Link
                href="/dashboard/teacher"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:underline"
              >
                Go to teacher dashboard
                <ArrowRight className="size-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/dashboard/classes/${cls.id}`}
              className="block"
            >
              <Card className="brutal-hover h-full overflow-hidden">
                <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-rose-300" />
                <CardHeader>
                  <CardTitle className="text-lg">{cls.name}</CardTitle>
                  <CardDescription>
                    Taught by{" "}
                    <span className="font-bold text-slate-900">
                      {teacherNameById[cls.teacher_id] ?? "Unknown"}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="emerald">
                      <GraduationCap className="size-3" />
                      {studentCountByClass[cls.id] ?? 0}{" "}
                      {studentCountByClass[cls.id] === 1 ? "student" : "students"}
                    </Badge>
                    <span className="text-xs font-medium text-slate-500">
                      {formatDate(cls.created_at)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Open class
                    <ChevronRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
