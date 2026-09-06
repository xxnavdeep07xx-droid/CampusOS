import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { GlobalNotice } from "@/lib/types";

/**
 * POST /api/notices
 *
 * Body: { schoolId, title, content, publishDate? }
 *
 * Auth: caller must be a principal or staff of the school.
 */
export async function POST(request: Request) {
  let body: {
    schoolId?: string;
    title?: string;
    content?: string;
    publishDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const schoolId = body.schoolId?.trim();
  const title = body.title?.trim();
  const content = body.content?.trim();
  const publishDate = body.publishDate || null;

  if (!schoolId || !title || !content) {
    return NextResponse.json(
      { error: "schoolId, title, and content are required." },
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (profile.role !== "principal" && profile.role !== "staff") {
    return NextResponse.json(
      { error: "Only principals and staff can publish notices." },
      { status: 403 }
    );
  }
  if (profile.school_id !== schoolId) {
    return NextResponse.json(
      { error: "School ID doesn't match your profile." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await admin
    .from("global_notices")
    .insert({
      school_id: schoolId,
      title,
      content,
      publish_date: publishDate,
      is_active: true,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (insErr || !row) {
    return NextResponse.json(
      {
        error:
          "Could not publish notice. Make sure the Phase 6 migration has been applied. " +
          (insErr?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ notice: row as GlobalNotice });
}

/**
 * GET /api/notices?schoolId=...
 *
 * Returns active notices for the school (publish_date <= today).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json(
      { error: "Missing schoolId query param." },
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (profile.school_id !== schoolId) {
    return NextResponse.json(
      { error: "Not in your school." },
      { status: 403 }
    );
  }

  const { data: rows, error } = await admin
    .from("global_notices")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .lte("publish_date", new Date().toISOString().slice(0, 10))
    .order("publish_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not load notices. Make sure the Phase 6 migration has been applied. " +
          error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ notices: rows ?? [] });
}
