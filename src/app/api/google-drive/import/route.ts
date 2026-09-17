import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, CLASS_MATERIALS_BUCKET } from "@/lib/storage";
import { getValidAccessToken } from "@/lib/google-drive-server";

/**
 * POST /api/google-drive/import
 *
 * Body: { fileId, classId, title }
 *
 * Downloads a file from the teacher's Google Drive and imports it into
 * the class's `class_materials` bucket + creates a `resources` row.
 *
 * This is the "import to class" action — teachers browse their Google
 * Drive files, then click "Import to class" to make a copy available to
 * students.
 *
 * Auth: caller must be the teacher of the class + have a Google Drive connection.
 */
export async function POST(request: Request) {
  let body: { fileId?: string; classId?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fileId = body.fileId?.trim();
  const classId = body.classId?.trim();
  const title = body.title?.trim();
  if (!fileId || !classId || !title) {
    return NextResponse.json(
      { error: "fileId, classId, and title are required." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Verify the caller is the teacher of the class.
  const admin = createAdminClient();
  const { data: clsRow } = await admin
    .from("classes")
    .select("teacher_id, school_id")
    .eq("id", classId)
    .single();
  const cls = clsRow as { teacher_id: string; school_id: string } | null;
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (cls.teacher_id !== user.id) {
    // Allow school admins too
    const { data: callerRow } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    const caller = callerRow as { role: string; school_id: string | null } | null;
    const isSchoolAdmin =
      (caller?.role === "principal" || caller?.role === "staff") &&
      caller?.school_id === cls.school_id;
    if (!isSchoolAdmin) {
      return NextResponse.json(
        { error: "Only the teacher of this class can import files." },
        { status: 403 }
      );
    }
  }

  // Get a valid Google access token.
  let accessToken: string;
  try {
    const token = await getValidAccessToken(user.id);
    if (!token) {
      return NextResponse.json(
        { error: "Google Drive not connected.", notConnected: true },
        { status: 403 }
      );
    }
    accessToken = token;
  } catch (err) {
    return NextResponse.json(
      { error: "Google Drive token expired. Please reconnect.", tokenError: true },
      { status: 403 }
    );
  }

  // Fetch file metadata (name + MIME type + size).
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) {
    return NextResponse.json(
      { error: `Google Drive API error: HTTP ${metaRes.status}` },
      { status: metaRes.status }
    );
  }
  const meta = await metaRes.json();

  // 50MB limit (same as the class_materials bucket).
  const fileSize = Number(meta.size ?? 0);
  if (fileSize > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: `File is too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Max 50 MB.` },
      { status: 413 }
    );
  }

  // Download the file content from Google Drive.
  const contentRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!contentRes.ok) {
    return NextResponse.json(
      { error: `Failed to download from Google Drive: HTTP ${contentRes.status}` },
      { status: contentRes.status }
    );
  }

  const fileBuffer = Buffer.from(await contentRes.arrayBuffer());

  // Build a storage path + upload to the class_materials bucket.
  const originalName = meta.name ?? `${title}`;
  const storagePath = buildStoragePath(classId, originalName);
  const { error: uploadErr } = await admin
    .storage
    .from(CLASS_MATERIALS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: meta.mimeType ?? "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "Storage upload failed: " + uploadErr.message },
      { status: 500 }
    );
  }

  // Insert a resources row.
  const { data: resource, error: insErr } = await admin
    .from("resources")
    .insert({
      class_id: classId,
      title,
      description: `Imported from Google Drive (${meta.name ?? "unknown file"})`,
      file_path: storagePath,
      file_size: fileSize || null,
      mime_type: meta.mimeType ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insErr) {
    // Roll back the storage upload.
    await admin.storage.from(CLASS_MATERIALS_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ resource });
}
