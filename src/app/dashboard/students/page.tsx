import Link from "next/link";
import { GraduationCap, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import { StudentDirectorySearch } from "./student-directory-search";
import type { Profile } from "@/lib/types";

type ProfileWithClassId = Profile & { class_id?: string | null };

export default async function MyStudentsPage() {
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

  if (profile?.role !== "teacher") {
    return (
      <div className="space-y-4">
        <Tag color="bg-amber-200">Not available</Tag>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-bold text-slate-900">
              You don&apos;t have access to this view.
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Only teachers have a &ldquo;My Students&rdquo; view — principals can
              see all students from the staff list.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false });

  const classes = (classRows ?? []) as { id: string; name: string }[];
  const classIds = classes.map((c) => c.id);

  const { data: studentsRows } =
    classIds.length === 0
      ? { data: [] }
      : await supabase
          .from("profiles")
          .select("*")
          .in("class_id", classIds)
          .eq("role", "student")
          .order("created_at", { ascending: false });

  const students = (studentsRows ?? []) as ProfileWithClassId[];

  // Flatten into a search-friendly shape — the client component will group.
  const studentsWithClass = students.map((s) => ({
    id: s.id,
    full_name: s.full_name ?? "(no name)",
    class_id: s.class_id ?? "",
    class_name: classes.find((c) => c.id === s.class_id)?.name ?? "—",
    joined_at: s.created_at,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Tag color="bg-rose-300">My Students</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Students you teach
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {students.length} {students.length === 1 ? "student" : "students"} across{" "}
          {classes.length} {classes.length === 1 ? "class" : "classes"}. Click any
          student to see their attendance history, grades, behavior log, and parent
          contact info.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-rose-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <GraduationCap className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">No classes yet.</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Create a class first, then generate student invite links.
            </p>
          </CardContent>
        </Card>
      ) : (
        <StudentDirectorySearch students={studentsWithClass} />
      )}
    </div>
  );
}
