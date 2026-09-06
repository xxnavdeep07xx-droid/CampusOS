import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CLASS_MATERIALS_BUCKET } from "@/lib/storage";
import type { Resource } from "@/lib/types";

/**
 * POST /api/whiteboard/export
 *
 * Body (multipart/form-data):
 *   - image: the canvas PNG (as a File OR a base64 data URL string)
 *   - classId: the class to associate the resource with
 *   - title: the resource title (e.g. "Whiteboard — Sep 6 lecture")
 *
 * Flow:
 *   1. Decode the image (base64 data URL → Uint8Array OR use the File directly).
 *   2. Build a storage path: `<class_id>/whiteboard-<uuid>.png`.
 *   3. Upload to the class_materials bucket via the service-role client
 *      (so we bypass RLS — the auth check is done in step 4 below).
 *   4. Authorize: caller must be the teacher of the class.
 *   5. Insert a resources row referencing the uploaded file.
 *
 * Returns the new Resource row.
 */
export async function POST(request: Request) {
  // Auth first — even before parsing the body — so anonymous users can't
  // upload to the bucket.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // Parse multipart form data.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body." },
      { status: 400 }
    );
  }

  const classId = String(formData.get("classId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const imageField = formData.get("image");

  if (!classId || !title || !imageField) {
    return NextResponse.json(
      { error: "classId, title, and image are required." },
      { status: 400 }
    );
  }
  if (title.length < 2) {
    return NextResponse.json(
      { error: "Title must be at least 2 characters." },
      { status: 400 }
    );
  }

  // Verify the caller is the teacher of this class.
  const admin = createAdminClient();
  const { data: cls } = await admin
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .single();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can export whiteboard images." },
      { status: 403 }
    );
  }

  // Convert the image field to a Uint8Array (regardless of whether it came
  // in as a File or a base64 data URL string).
  let bytes: Uint8Array;
  let mime = "image/png";
  if (imageField instanceof File) {
    const buf = await imageField.arrayBuffer();
    bytes = new Uint8Array(buf);
    if (imageField.type) mime = imageField.type;
  } else if (typeof imageField === "string") {
    // data:image/png;base64,iVBOR...
    const match = /^data:([^;]+);base64,(.*)$/s.exec(imageField);
    if (!match) {
      return NextResponse.json(
        { error: "image string must be a base64 data URL." },
        { status: 400 }
      );
    }
    mime = match[1];
    bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  } else {
    return NextResponse.json(
      { error: "image must be a File or a base64 data URL string." },
      { status: 400 }
    );
  }

  // Build the storage path + upload.
  const uuid = crypto.randomUUID();
  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "png";
  const storagePath = `${classId}/whiteboard-${uuid}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(CLASS_MATERIALS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      {
        error:
          "Could not upload whiteboard image. Make sure the Phase 2 migration (which creates the class_materials bucket) has been applied. " +
          uploadErr.message,
      },
      { status: 500 }
    );
  }

  // Insert a resources row pointing to the uploaded file.
  const { data: resourceRow, error: insErr } = await admin
    .from("resources")
    .insert({
      class_id: classId,
      title,
      description: "Saved from the digital whiteboard.",
      file_path: storagePath,
      file_size: bytes.byteLength,
      mime_type: mime,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insErr || !resourceRow) {
    // The upload succeeded but the resource row failed — best-effort
    // cleanup of the orphaned file so the bucket doesn't accumulate junk.
    await admin.storage.from(CLASS_MATERIALS_BUCKET).remove([storagePath]);
    return NextResponse.json(
      {
        error:
          "Could not create resource row. Make sure the Phase 2 migration has been applied. " +
          (insErr?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    resource: resourceRow as Resource,
    storagePath,
  });
}
