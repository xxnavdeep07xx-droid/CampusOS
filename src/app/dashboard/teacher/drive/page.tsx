import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { TeacherDriveClient } from "./teacher-drive-client";
import { GoogleDriveClient } from "./google-drive-client";
import type { Profile, TeacherFile } from "@/lib/types";
import { isGoogleDriveConfigured } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/drive
 *
 * Personal teacher drive — two storage providers:
 *   1. CampusOS storage (Supabase class_materials bucket) — always available
 *   2. Google Drive (optional) — teachers can connect their Google account
 *      to browse + import files from their Drive
 */
export default async function TeacherDrivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/drive");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;

  if (profile?.role !== "teacher" && profile?.role !== "principal" && profile?.role !== "staff") {
    return (
      <div className="space-y-4">
        <Tag color="bg-rose-400">Access restricted</Tag>
        <p className="text-sm font-medium text-slate-700">
          The teacher drive is only available to teachers.
        </p>
      </div>
    );
  }

  // Fetch teacher's classes (for the share-with-class dropdown).
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");
  const classes = (classRows ?? []) as { id: string; name: string }[];

  // Fetch all files in the teacher's drive (RLS enforced).
  const { data: fileRows, error } = await supabase
    .from("teacher_files")
    .select(`
      *,
      shared_with_class:classes!teacher_files_shared_with_class_id_fkey(id, name)
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  let files: TeacherFile[] = [];
  if (error && /Could not find the table|does not exist/i.test(error.message)) {
    files = [];
  } else if (!error && fileRows) {
    files = fileRows as TeacherFile[];
  }

  // Check if Google Drive env vars are configured.
  const googleConfigured = isGoogleDriveConfigured();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-violet-400">My Drive</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Personal file storage
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Keep your presentations, worksheets, and past exam papers here —
          separate from class resources. Optionally connect Google Drive to
          import files from your existing Drive.
        </p>
      </div>

      {/* CampusOS storage */}
      <TeacherDriveClient
        initialFiles={files}
        classes={classes}
        migrationMissing={!!error && /Could not find the table|does not exist/i.test(error.message)}
      />

      {/* Google Drive integration (optional) */}
      <div className="space-y-3 border-t-2 border-slate-200 pt-6">
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
          Google Drive
        </h2>
        <GoogleDriveClient classes={classes} isConfigured={googleConfigured} />
      </div>
    </div>
  );
}
