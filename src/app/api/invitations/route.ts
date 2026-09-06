import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteUrl, type UserRole } from "@/lib/types";

/**
 * POST /api/invitations
 *
 * Body: { role: "staff" | "teacher" | "student", classId?: string }
 *
 * Auth: caller must be signed in. Their profile determines what kinds of
 * invitations they're allowed to create:
 *
 *   - principal / staff  → may create staff, teacher invites (no classId)
 *   - teacher            → may create student invites for a class they own
 *                          (classId required, must be theirs)
 *
 * Returns: { token, url, role, classId?, id, createdAt } on success,
 *          { error } with HTTP 4xx on failure.
 */
export async function POST(request: Request) {
  // ----- Parse + validate input -----
  let body: { role?: string; classId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const role = body.role as UserRole | undefined;
  if (!role || !["staff", "teacher", "student"].includes(role)) {
    return NextResponse.json(
      { error: "Invalid role. Must be one of: staff, teacher, student." },
      { status: 400 }
    );
  }

  // ----- Authenticate the caller -----
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to generate invitations." },
      { status: 401 }
    );
  }

  // Fetch the caller's profile (server-side, RLS-protected).
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json(
      { error: "Your profile could not be loaded." },
      { status: 403 }
    );
  }
  if (!profile.school_id) {
    return NextResponse.json(
      { error: "Your account is not linked to a school." },
      { status: 403 }
    );
  }

  const callerRole = profile.role as UserRole;

  // ----- Authorization matrix -----
  // Principals + staff can issue staff / teacher invites.
  // Teachers can issue student invites — but only for a class they own.
  let classId: string | null = null;

  if (role === "student") {
    if (callerRole !== "teacher" && callerRole !== "principal" && callerRole !== "staff") {
      return NextResponse.json(
        { error: "Only teachers, staff, or principals can issue student invites." },
        { status: 403 }
      );
    }
    // A classId is required. For teachers, it must be a class they own.
    // For principals/staff creating a student invite, it must be a class in
    // their school.
    if (!body.classId) {
      return NextResponse.json(
        { error: "A classId is required when creating a student invite." },
        { status: 400 }
      );
    }

    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, school_id, teacher_id")
      .eq("id", body.classId)
      .single();

    if (clsErr || !cls) {
      return NextResponse.json(
        { error: "Class not found." },
        { status: 404 }
      );
    }
    if (cls.school_id !== profile.school_id) {
      return NextResponse.json(
        { error: "That class does not belong to your school." },
        { status: 403 }
      );
    }
    if (callerRole === "teacher" && cls.teacher_id !== user.id) {
      return NextResponse.json(
        { error: "You can only issue invites for classes you teach." },
        { status: 403 }
      );
    }
    classId = cls.id;
  } else if (role === "staff" || role === "teacher") {
    if (callerRole !== "principal" && callerRole !== "staff") {
      return NextResponse.json(
        {
          error:
            "Only principals and staff can issue staff or teacher invitations.",
        },
        { status: 403 }
      );
    }
  }

  // ----- Insert the invitation row using the service-role client -----
  // We use the admin client because we want to set `created_by` = caller's
  // profile id (which is the same as their auth.uid), and we want to bypass
  // any potential policy mismatch on the `created_by` foreign key.
  const admin = createAdminClient();

  const { data: invitation, error: invErr } = await admin
    .from("invitations")
    .insert({
      school_id: profile.school_id,
      class_id: classId,
      role,
      created_by: profile.id,
    })
    .select("id, token, role, class_id, created_at")
    .single();

  if (invErr || !invitation) {
    return NextResponse.json(
      {
        error:
          "Could not create invitation: " +
          (invErr?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  const url = inviteUrl(invitation.token, role as UserRole);

  return NextResponse.json({
    id: invitation.id,
    token: invitation.token,
    url,
    role: invitation.role,
    classId: invitation.class_id,
    createdAt: invitation.created_at,
  });
}

/**
 * GET /api/invitations
 *
 * Returns all invitations for the caller's school (principal/staff) or only
 * those created by the caller (teacher).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.school_id) {
    return NextResponse.json(
      { error: "No profile / school found for your account." },
      { status: 403 }
    );
  }

  const callerRole = profile.role as UserRole;

  let query = supabase
    .from("invitations")
    .select(
      "id, role, token, is_used, class_id, created_at, created_by, classes(name)"
    )
    .eq("school_id", profile.school_id);

  // Teachers only see their own student invites.
  if (callerRole === "teacher") {
    query = query.eq("created_by", profile.id);
  }

  const { data: invitations, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  // Attach the public URL on the server so the client doesn't have to
  // re-derive it.
  const withUrls = (invitations ?? []).map((inv) => ({
    id: inv.id,
    role: inv.role,
    token: inv.token,
    isUsed: inv.is_used,
    classId: inv.class_id,
    className: (inv.classes as { name: string } | null)?.name ?? null,
    createdAt: inv.created_at,
    url: inviteUrl(inv.token, inv.role as UserRole),
  }));

  return NextResponse.json({ invitations: withUrls });
}
