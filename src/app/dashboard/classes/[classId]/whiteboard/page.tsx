import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PencilRuler, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { WhiteboardBoardGallery } from "./board-gallery-client";
import { Whiteboard } from "@/components/brutal/whiteboard";
import type { ClassRoom, Profile, WhiteboardBoard } from "@/lib/types";
import { publicStorageUrl, CLASS_MATERIALS_BUCKET, formatDate } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Whiteboard page at /dashboard/classes/[classId]/whiteboard.
 *
 * Two modes:
 *   1. Gallery mode (default): shows a grid of saved boards + "New board" button.
 *   2. Editor mode (?board=ID): opens a specific board in the full-screen
 *      Whiteboard component with auto-save.
 *
 * Teachers + principals/staff: full editing + create/delete boards.
 * Students: read-only board view (can view any board but can't edit/save).
 */
export default async function WhiteboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ board?: string }>;
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

  const isTeacher = cls.teacher_id === user.id;
  const isSchoolAdmin = profile.role === "principal" || profile.role === "staff";
  const isEnrolledStudent =
    profile.role === "student" && profile.class_id === classId;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    notFound();
  }

  const canEdit = isTeacher || isSchoolAdmin;

  // Fetch all boards for this class.
  const { data: boardRows, error: boardErr } = await supabase
    .from("whiteboard_boards")
    .select(`
      *,
      creator:profiles!whiteboard_boards_created_by_fkey(id, full_name)
    `)
    .eq("class_id", classId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  const boards = (boardRows ?? []) as WhiteboardBoard[];

  const sp = await searchParams;
  const activeBoardId = sp.board?.trim() || null;

  // If a specific board is requested, fetch it + render the editor.
  if (activeBoardId) {
    const { data: activeBoard } = await supabase
      .from("whiteboard_boards")
      .select("*")
      .eq("id", activeBoardId)
      .eq("class_id", classId)
      .single();
    if (!activeBoard) {
      redirect(`/dashboard/classes/${classId}/whiteboard`);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/dashboard/classes/${classId}/whiteboard`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            Back to boards
          </Link>
          <div className="flex items-center gap-2">
            <Tag color="bg-sky-300">
              <PencilRuler className="size-3.5" />
              {(activeBoard as any).name}
            </Tag>
            {!canEdit && <Tag color="bg-amber-200">Student view · read-only</Tag>}
          </div>
        </div>
        <Whiteboard
          classId={classId}
          className={cls.name}
          canEdit={canEdit}
          boardId={activeBoardId}
          initialStrokes={(activeBoard as any).strokes_data ?? []}
          boardName={(activeBoard as any).name}
        />
      </div>
    );
  }

  // Gallery mode — show the list of boards.
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
          Whiteboard
        </h1>
        <p className="text-sm font-medium text-slate-600">
          {canEdit
            ? "Create named boards for different topics — your work auto-saves. Click any board to open it."
            : "Browse your teacher's boards below. Click any board to view it."}
        </p>
      </div>

      <WhiteboardBoardGallery
        classId={classId}
        initialBoards={boards}
        canEdit={canEdit}
        migrationMissing={!!boardErr && /Could not find the table|does not exist/i.test(boardErr.message)}
      />
    </div>
  );
}
