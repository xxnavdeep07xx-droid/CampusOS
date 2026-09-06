import Link from "next/link";
import { ArrowRight, Building2, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import type { ClassRoom, Profile } from "@/lib/types";

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

  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("school_id", profile?.school_id ?? "")
    .order("created_at", { ascending: false });

  if (profile?.role === "teacher") {
    classQuery = classQuery.eq("teacher_id", user!.id);
  }

  const { data: classRows } = await classQuery;
  const classes = (classRows ?? []) as ClassRoom[];

  const teacherIds = Array.from(
    new Set(classes.map((c) => c.teacher_id))
  );
  const classIds = classes.map((c) => c.id);

  const [{ data: teacherRows }, { count: totalStudents }] = await Promise.all([
    teacherIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("school_id", profile?.school_id ?? ""),
  ]);

  const teacherNameById: Record<string, string> = {};
  for (const t of (teacherRows ?? []) as { id: string; full_name: string }[]) {
    teacherNameById[t.id] = t.full_name || "Unnamed";
  }

  const studentCountsByClass = await Promise.all(
    classIds.map((cid) =>
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("class_id", cid)
        .eq("role", "student")
        .then(({ count }) => [cid, count ?? 0] as const)
    )
  );
  const studentCountByClass = Object.fromEntries(studentCountsByClass);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Tag color="bg-amber-300">Classes</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          {profile?.role === "teacher" ? "Your classes" : "All classes"}
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {classes.length} {classes.length === 1 ? "class" : "classes"} ·{" "}
          {totalStudents ?? 0} students enrolled
        </p>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-amber-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Building2 className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">No classes yet.</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {profile?.role === "teacher"
                ? "Create your first class from the teacher dashboard."
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
            <Card key={cls.id} className="brutal-hover overflow-hidden">
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
                    {studentCountByClass[cls.id] ?? 0} students
                  </Badge>
                  <span className="text-xs font-medium text-slate-500">
                    {new Date(cls.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
