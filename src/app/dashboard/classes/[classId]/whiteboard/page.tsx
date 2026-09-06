import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PencilRuler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { Whiteboard } from "@/components/brutal/whiteboard";
import type { ClassRoom, Profile } from "@/lib/types";

/**
 * Whiteboard page at /dashboard/classes/[classId]/whiteboard.
 *
 * Server component. Authorizes the caller (must be a member of the class's
 * school), then renders the Whiteboard client component.
 *
 * - Teachers + principals/staff: full editing + Export & Share button.
 * - Students: read-only board (canEdit=false) — they can view + download
 *   the PNG locally but cannot push to the class_materials bucket.
 */
export default async function WhiteboardPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileRow }, { data: classRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("classes").select("*").eq("id", classId).single(),
  ]);
  const profile = profileRow as Profile | null;
  const cls = classRow as ClassRoom | null;
  if (!cls) notFound();
  if (!profile || profile.school_id !== cls.school_id) notFound();

  // Authorization: caller must be the teacher, a principal/staff of the
  // school, OR a student enrolled in this specific class.
  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin =
    profile.role === "principal" || profile.role === "staff";
  const isEnrolledStudent =
    profile.role === "student" && profile.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    notFound();
  }

  // Only the teacher of THIS class (or a school admin acting on it) can
  // edit + export. Students get a read-only view.
  const canEdit = isTeacher || isSchoolAdmin;

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
          <Tag color="bg-sky-300">
            <PencilRuler className="size-3.5" />
            Whiteboard
          </Tag>
          <Tag color="bg-emerald-300">{cls.name}</Tag>
          {!canEdit && (
            <Tag color="bg-amber-200">Student view · read-only</Tag>
          )}
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Digital board
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {canEdit
            ? "Draw, write, and share. Use Export & Share with Class to publish a snapshot as a resource students can download."
            : "Watch your teacher's board in real time. You can download the current snapshot as a PNG."}
        </p>
      </div>

      <Whiteboard classId={classId} className={cls.name} canEdit={canEdit} />
    </div>
  );
}
