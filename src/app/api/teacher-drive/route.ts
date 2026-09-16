import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildTeacherStoragePath, TEACHER_FILES_BUCKET } from "@/lib/storage";
import type { TeacherFile } from "@/lib/types";

/**
 * GET /api/teacher-drive?folder=...
 *
 * Returns files in the caller's personal teacher drive, optionally
 * filtered by folder. Returns files for the current folder only (no
 * recursion) — sub-folders are surfaced as virtual rows with mime_type
 * 'application/x-folder'.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get all files in the teacher's drive (regardless of folder). We'll
  // compute the immediate-children client-side to support folder drilldown.
  const { data: allFiles, error } = await admin
    .from("teacher_files")
    .select(`
      *,
      shared_with_class:classes!teacher_files_shared_with_class_id_fkey(id, name)
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ files: [], folders: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = (allFiles ?? []) as (TeacherFile & {
    shared_with_class?: { id: string; name: string } | null;
  })[];

  // Filter to immediate children of `folder`. A file in folder "Worksheets/Algebra"
  // is an immediate child of "Worksheets/Algebra" itself, OR a direct child of
  // "Worksheets" if its folder path is exactly "Worksheets".
  // Sub-folders: derive from folder prefixes of files in deeper paths.
  const seenSubfolders = new Set<string>();
  const files: typeof all = [];
  for (const f of all) {
    const fileFolder = f.folder ?? "";
    if (fileFolder === folder) {
      files.push(f);
    } else if (folder === "" ? fileFolder.includes("/") : fileFolder.startsWith(folder + "/")) {
      // This file is in a deeper subfolder — record the immediate subfolder name.
      const afterFolder = folder === "" ? fileFolder : fileFolder.slice(folder.length + 1);
      const subName = afterFolder.split("/")[0];
      seenSubfolders.add(subName);
    }
  }

  const folders = Array.from(seenSubfolders).map((name) => ({
    name,
    full_path: folder === "" ? name : `${folder}/${name}`,
  }));

  return NextResponse.json({
    files,
    folders,
    currentFolder: folder,
  });
}

/**
 * POST /api/teacher-drive
 *
 * Body (multipart/form-data): { file: File, folder?: string, description?: string }
 *
 * Uploads a file to the teacher's personal drive.
 *
 * The flow:
 *   1. Server reads the file into a Buffer.
 *   2. Builds a path: <owner_id>/<uuid>.<ext> in the teacher_files bucket.
 *   3. Uploads to Supabase Storage via the admin client (bypasses RLS — but
 *      we still verify the caller is signed in).
 *   4. Inserts a teacher_files row (RLS-enforced owner_id = auth.uid()).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field." }, { status: 400 });
  }
  const folder = (formData.get("folder") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File exceeds the 50 MB limit." },
      { status: 413 }
    );
  }

  const admin = createAdminClient();
  const storagePath = buildTeacherStoragePath(user.id, file.name);

  // Upload to storage.
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin
    .storage
    .from(TEACHER_FILES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "Storage upload failed: " + uploadErr.message },
      { status: 500 }
    );
  }

  // Insert the DB row.
  const { data: row, error: insErr } = await admin
    .from("teacher_files")
    .insert({
      owner_id: user.id,
      file_path: storagePath,
      name: file.name,
      description,
      file_size: file.size,
      mime_type: file.type || null,
      folder,
    })
    .select("*")
    .single();

  if (insErr) {
    // Roll back the storage upload since the DB insert failed.
    await admin.storage.from(TEACHER_FILES_BUCKET).remove([storagePath]);
    if (/Could not find the table|does not exist/i.test(insErr.message)) {
      return NextResponse.json(
        {
          error:
            "The teacher_files table doesn't exist yet. Apply supabase/migrations/0010_academic_hub.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ file: row as TeacherFile });
}
