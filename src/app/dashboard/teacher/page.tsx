import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/brutal/section";
import { InviteCard } from "@/components/brutal/invite-card";
import { CreateClassForm } from "./create-class-form";
import type { ClassRoom, Profile, Invitation, UserRole } from "@/lib/types";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the teacher's profile.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();
  const profile = profileRow as Profile | null;

  // Fetch the classes this teacher owns.
  const { data: classRows } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false });
  const classes = (classRows ?? []) as ClassRoom[];

  // Fetch student count per class + outstanding student invites per class.
  const studentCountByClass: Record<string, number> = {};
  const invitesByClass: Record<
    string,
    Array<{
      id: string;
      token: string;
      is_used: boolean;
      created_at: string;
    }>
  > = {};

  if (classes.length > 0) {
    const classIds = classes.map((c) => c.id);

    const [{ data: students }, { data: invites }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, class_id")
        .in("class_id", classIds)
        .eq("role", "student"),
      supabase
        .from("invitations")
        .select("id, token, is_used, created_at, class_id")
        .in("class_id", classIds)
        .order("created_at", { ascending: false }),
    ]);

    for (const s of students ?? []) {
      const cid = (s as { class_id: string }).class_id;
      studentCountByClass[cid] = (studentCountByClass[cid] ?? 0) + 1;
    }
    for (const inv of invites ?? []) {
      const cid = (inv as { class_id: string }).class_id;
      if (!invitesByClass[cid]) invitesByClass[cid] = [];
      invitesByClass[cid].push(inv as (typeof invitesByClass[string])[number]);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Tag color="bg-violet-300">Teacher dashboard</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Your classes
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Create classes and generate student invite links. Each invite produces
          a one-use URL and a scannable QR code — students land in the right
          class automatically.
        </p>
      </div>

      {/* Create-class form */}
      <CreateClassForm />

      {/* Existing classes */}
      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-violet-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Sparkles className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No classes yet — create your first class above.
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              Once you have a class, you&apos;ll be able to generate student
              invites here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-black uppercase tracking-tight">
            {classes.length} {classes.length === 1 ? "class" : "classes"}
          </h2>

          {classes.map((cls) => (
            <Card key={cls.id} className="overflow-hidden">
              <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-rose-300" />
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{cls.name}</CardTitle>
                    <CardDescription>
                      Created {new Date(cls.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="emerald">
                      {studentCountByClass[cls.id] ?? 0} students
                    </Badge>
                    <Badge variant="outline">
                      {(invitesByClass[cls.id] ?? []).filter((i) => !i.is_used).length} active invites
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <InviteCard
                  role="student"
                  classId={cls.id}
                  title={`Invite students to "${cls.name}"`}
                  description="Each link is one-use — students scan or click it, fill in their name + email + password, and they're in."
                  accentColor="bg-rose-300"
                  ctaLabel="Generate student invite"
                />

                {(invitesByClass[cls.id] ?? []).length > 0 && (
                  <div className="mt-5 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Recent invites for this class
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(invitesByClass[cls.id] ?? []).map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded-lg border-2 border-slate-900 bg-[#FDFBF7] px-3 py-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                        >
                          <code className="truncate font-mono text-xs text-slate-700">
                            {inv.token.slice(0, 8)}…{inv.token.slice(-4)}
                          </code>
                          {inv.is_used ? (
                            <Badge variant="destructive">Used</Badge>
                          ) : (
                            <Badge variant="emerald">Active</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
