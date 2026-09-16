import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, CLASS_MATERIALS_BUCKET } from "@/lib/storage";
import type { AssignmentResource } from "@/lib/types";

/**
 * GET /api/assignment-resources?assignmentId=...
 *
 * Returns all resources (files + links) attached to an assignment.
 *
 * Auth: caller must be the teacher of the assignment's class, a school admin,
 * or a student enrolled in that class (read-only).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const assignmentId = url.searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json(
      { error: "Missing assignmentId query param." },
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

  const admin = createAdminClient();

  // Verify authorization via the assignment's class.
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id, classes!inner(teacher_id, school_id)")
    .eq("id", assignmentId)
    .single();
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  const cls = (
    Array.isArray((assignment as any).classes) ? (assignment as any).classes[0] : (assignment as any).classes
  ) as { teacher_id: string; school_id: string } | null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, school_id, class_id")
    .eq("id", user.id)
    .single();
  const profile = profileRow as { role: string; school_id: string | null; class_id: string | null } | null;

  const isTeacher = cls?.teacher_id === user.id;
  const isSchoolAdmin =
    (profile?.role === "principal" || profile?.role === "staff") &&
    profile?.school_id != null &&
    profile.school_id === cls?.school_id;
  const isEnrolledStudent =
    profile?.role === "student" && profile.class_id === (assignment as any).class_id;
  if (!isTeacher && !isSchoolAdmin && !isEnrolledStudent) {
    return NextResponse.json(
      { error: "Not authorized to view this assignment's resources." },
      { status: 403 }
    );
  }

  const { data: rows, error } = await admin
    .from("assignment_resources")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ resources: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ resources: rows as AssignmentResource[] });
}

/**
 * POST /api/assignment-resources
 *
 * Two modes:
 *   1. JSON body — attach a link: { assignmentId, kind: 'link', url, label }
 *   2. multipart/form-data — attach a file: { assignmentId, file, label }
 *
 * Auth: caller must be the teacher of the assignment's class.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  let assignmentId: string | undefined;
  let label: string | undefined;
  let url: string | null = null;
  let file: File | null = null;

  if (contentType.includes("application/json")) {
    let body: { assignmentId?: string; kind?: string; url?: string; label?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (body.kind !== "link") {
      return NextResponse.json(
        { error: "JSON mode only supports kind='link'. Use multipart/form-data for file uploads." },
        { status: 400 }
      );
    }
    assignmentId = body.assignmentId?.trim();
    url = body.url?.trim() ?? null;
    label = body.label?.trim();
    if (!url) {
      return NextResponse.json({ error: "url is required for kind='link'." }, { status: 400 });
    }
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    assignmentId = (formData.get("assignmentId") as string | null)?.trim();
    label = (formData.get("label") as string | null)?.trim() ?? undefined;
    const f = formData.get("file");
    if (f instanceof File) file = f;
    if (!file) {
      return NextResponse.json({ error: "Missing 'file' field." }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "Unsupported content-type. Use application/json or multipart/form-data." },
      { status: 400 }
    );
  }

  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label is required." }, { status: 400 });
  }

  // Verify authorization: caller must be the teacher of the assignment's class.
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", assignmentId)
    .single();
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  const cls = (
    Array.isArray((assignment as any).classes) ? (assignment as any).classes[0] : (assignment as any).classes
  ) as { teacher_id: string } | null;
  if (!cls || cls.teacher_id !== user.id) {
    return NextResponse.json(
      { error: "Only the teacher of this class can attach resources." },
      { status: 403 }
    );
  }

  // Determine the position (append after existing attachments).
  const { data: maxRow } = await admin
    .from("assignment_resources")
    .select("position")
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((maxRow as { position: number } | null)?.position ?? -1) + 1;

  if (file) {
    // File upload mode
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds the 50 MB limit." }, { status: 413 });
    }
    const storagePath = buildStoragePath((assignment as any).class_id, file.name);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await admin
      .storage
      .from(CLASS_MATERIALS_BUCKET)
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

    const { data: row, error: insErr } = await admin
      .from("assignment_resources")
      .insert({
        assignment_id: assignmentId,
        kind: "file",
        storage_path: storagePath,
        url: null,
        label,
        file_size: file.size,
        mime_type: file.type || null,
        position: nextPosition,
      })
      .select("*")
      .single();

    if (insErr) {
      // Roll back the storage upload.
      await admin.storage.from(CLASS_MATERIALS_BUCKET).remove([storagePath]);
      if (/Could not find the table|does not exist/i.test(insErr.message)) {
        return NextResponse.json(
          {
            error:
              "The assignment_resources table doesn't exist yet. Apply supabase/migrations/0010_academic_hub.sql first.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ resource: row as AssignmentResource });
  } else {
    // Link mode
    const { data: row, error: insErr } = await admin
      .from("assignment_resources")
      .insert({
        assignment_id: assignmentId,
        kind: "link",
        storage_path: null,
        url: url!,
        label,
        file_size: null,
        mime_type: null,
        position: nextPosition,
      })
      .select("*")
      .single();

    if (insErr) {
      if (/Could not find the table|does not exist/i.test(insErr.message)) {
        return NextResponse.json(
          {
            error:
              "The assignment_resources table doesn't exist yet. Apply supabase/migrations/0010_academic_hub.sql first.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ resource: row as AssignmentResource });
  }
}
