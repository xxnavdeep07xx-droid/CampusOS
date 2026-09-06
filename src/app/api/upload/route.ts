import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, CLASS_MATERIALS_BUCKET, STUDENT_SUBMISSIONS_BUCKET } from "@/lib/storage";

/**
 * POST /api/upload
 *
 * Body: { bucket: "class_materials" | "student_submissions", classId, filename, mimeType?, size? }
 *
 * Returns a signed upload URL that the browser can PUT the file directly to.
 * Also returns the final storage path so the client can later persist it to
 * the database (resources / submissions row).
 *
 * Auth:
 *   - class_materials    → caller must be the teacher of the class
 *   - student_submissions → caller must be a student enrolled in the class
 *
 * The signed URL is short-lived (120s) so a leaked URL can't be reused.
 */
export async function POST(request: Request) {
  let body: {
    bucket?: string;
    classId?: string;
    filename?: string;
    mimeType?: string;
    size?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bucket = body.bucket;
  const classId = body.classId?.trim();
  const filename = body.filename?.trim();
  const mimeType = body.mimeType;
  const size = body.size;

  if (!bucket || !classId || !filename) {
    return NextResponse.json(
      { error: "bucket, classId, and filename are required." },
      { status: 400 }
    );
  }
  if (bucket !== CLASS_MATERIALS_BUCKET && bucket !== STUDENT_SUBMISSIONS_BUCKET) {
    return NextResponse.json(
      { error: `Unknown bucket: ${bucket}` },
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

  // Fetch the caller's profile + the class to verify authorization.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, class_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "Your profile could not be loaded." },
      { status: 403 }
    );
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", classId)
    .single();

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  // Authorization check per bucket.
  if (bucket === CLASS_MATERIALS_BUCKET) {
    // Teacher of the class OR principal/staff of the school.
    const isTeacher = cls.teacher_id === user.id;
    const isSchoolAdmin =
      profile.role === "principal" || profile.role === "staff";
    const sameSchool = cls.school_id === profile.school_id;
    if (!(isTeacher || (isSchoolAdmin && sameSchool))) {
      return NextResponse.json(
        { error: "Only the teacher of this class (or a school admin) can upload class materials." },
        { status: 403 }
      );
    }
  } else {
    // student_submissions — caller must be a student enrolled in this class.
    if (profile.role !== "student") {
      return NextResponse.json(
        { error: "Only students can upload submissions." },
        { status: 403 }
      );
    }
    if (profile.class_id !== classId) {
      return NextResponse.json(
        { error: "You can only upload to classes you're enrolled in." },
        { status: 403 }
      );
    }
  }

  // Build the storage path: <class_id>/<uuid>.<ext>
  const storagePath = buildStoragePath(classId, filename);

  // Create a signed upload URL.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl || !data.path) {
    return NextResponse.json(
      {
        error:
          "Could not generate upload URL. Make sure the Phase 2 migration has been applied (it creates the storage buckets). " +
          (error?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket,
    path: data.path,
    signedUrl: data.signedUrl,
    mimeType,
    size,
    filename,
  });
}
