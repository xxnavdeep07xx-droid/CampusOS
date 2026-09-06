import Link from "next/link";
import { ArrowRight, Users, UserCog, GraduationCap, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import type { Profile, ClassRoom, UserRole } from "@/lib/types";

export default async function StaffListPage() {
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

  if (profile?.role !== "principal" && profile?.role !== "staff") {
    return (
      <div className="space-y-4">
        <Tag color="bg-amber-200">Not available</Tag>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-bold text-slate-900">
              You don&apos;t have access to the staff list.
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              This view is restricted to principals and staff members.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("*")
    .eq("school_id", profile!.school_id ?? "")
    .order("created_at", { ascending: false });
  const people = (profileRows ?? []) as Profile[];

  const { data: classRows } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", profile!.school_id ?? "");
  const classes = (classRows ?? []) as ClassRoom[];

  const teacherClassCount: Record<string, number> = {};
  for (const c of classes) {
    teacherClassCount[c.teacher_id] = (teacherClassCount[c.teacher_id] ?? 0) + 1;
  }

  const roleColor: Record<UserRole, string> = {
    principal: "bg-slate-900 text-[#FDFBF7]",
    staff: "bg-sky-300 text-slate-900",
    teacher: "bg-violet-300 text-slate-900",
    student: "bg-rose-300 text-slate-900",
  };

  const counts = {
    staff: people.filter((p) => p.role === "staff").length,
    teacher: people.filter((p) => p.role === "teacher").length,
    student: people.filter((p) => p.role === "student").length,
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Tag color="bg-sky-300">Staff &amp; Teachers</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Everyone at your school
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {people.length} {people.length === 1 ? "person" : "people"} across{" "}
          {counts.staff} staff, {counts.teacher} teachers, and{" "}
          {counts.student} students.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniStat icon={<UserCog className="size-5" />} label="Staff" value={counts.staff} color="bg-sky-300" />
        <MiniStat icon={<GraduationCap className="size-5" />} label="Teachers" value={counts.teacher} color="bg-violet-300" />
        <MiniStat icon={<Users className="size-5" />} label="Students" value={counts.student} color="bg-rose-300" />
        <MiniStat icon={<Building2 className="size-5" />} label="Classes" value={classes.length} color="bg-amber-300" />
      </div>

      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
        <CardHeader>
          <CardTitle>All members</CardTitle>
          <CardDescription>
            Ordered by join date (most recent first).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <div className="py-8 text-center text-sm font-medium text-slate-600">
              No members yet — generate an invite from the overview page.
            </div>
          ) : (
            <div className="divide-y-2 divide-slate-200">
              {people.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-sm font-black uppercase text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      {(p.full_name || "?").slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        {p.full_name || "(no name)"}
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        Joined {new Date(p.created_at).toLocaleDateString()}
                        {p.role === "teacher" && teacherClassCount[p.id] && (
                          <span className="ml-1">
                            • {teacherClassCount[p.id]}{" "}
                            {teacherClassCount[p.id] === 1 ? "class" : "classes"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize ${roleColor[p.role as UserRole]}`}
                  >
                    {p.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs font-medium text-slate-500">
        Need to add more people?{" "}
        <Link
          href="/dashboard"
          className="font-bold text-emerald-700 underline-offset-4 hover:underline"
        >
          Generate an invite <ArrowRight className="inline size-3" />
        </Link>
      </p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="brutal-hover overflow-hidden">
      <div className={`h-2 w-full border-x-2 border-t-2 border-slate-900 ${color}`} />
      <CardContent className="pt-4">
        <div className="flex items-center gap-2">
          <div
            className={`flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 ${color} shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]`}
          >
            {icon}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {label}
          </span>
        </div>
        <div className="mt-3 text-3xl font-black text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}
