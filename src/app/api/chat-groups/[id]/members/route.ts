import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroupMember } from "@/lib/types";

/**
 * GET /api/chat-groups/[id]/members
 *
 * Returns all members of a group with their profile info.
 *
 * Auth: caller must be a member of the group or a school admin.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const groupId = params.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Verify membership (or school admin).
  const { data: membership } = await admin
    .from("chat_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    const { data: groupRow } = await admin
      .from("chat_groups")
      .select("school_id")
      .eq("id", groupId)
      .single();
    const { data: callerRow } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    const caller = callerRow as { role: string; school_id: string | null } | null;
    const group = groupRow as { school_id: string } | null;
    const isSchoolAdmin =
      (caller?.role === "principal" || caller?.role === "staff") &&
      caller?.school_id === group?.school_id;
    if (!isSchoolAdmin) {
      return NextResponse.json({ error: "Not a member of this group." }, { status: 403 });
    }
  }

  const { data: members, error } = await admin
    .from("chat_group_members")
    .select(`
      *,
      profile:profiles!chat_group_members_user_id_fkey(id, full_name, role)
    `)
    .eq("group_id", groupId)
    .order("role", { ascending: false }) // admins first
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members: members as ChatGroupMember[] });
}

/**
 * POST /api/chat-groups/[id]/members
 *
 * Body: { userId, role? }
 *
 * Adds a new member to the group. Only group admins or school admins
 * can add members.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const groupId = params.id;

  let body: { userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Verify the caller is an admin of the group (or school admin).
  const { data: myMembership } = await admin
    .from("chat_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = (myMembership as any)?.role === "admin";
  let isSchoolAdmin = false;
  if (!isAdmin) {
    const { data: groupRow } = await admin
      .from("chat_groups")
      .select("school_id, created_by")
      .eq("id", groupId)
      .single();
    const { data: callerRow } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    const caller = callerRow as { role: string; school_id: string | null } | null;
    const group = groupRow as { school_id: string; created_by: string } | null;
    isSchoolAdmin =
      (caller?.role === "principal" || caller?.role === "staff") &&
      caller?.school_id === group?.school_id;
    const isCreator = group?.created_by === user.id;
    if (!isSchoolAdmin && !isCreator) {
      return NextResponse.json({ error: "Only group admins can add members." }, { status: 403 });
    }
  }

  // Verify the target user is in the same school.
  const { data: groupRow } = await admin
    .from("chat_groups")
    .select("school_id")
    .eq("id", groupId)
    .single();
  const { data: targetUser } = await admin
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .single();
  if (!targetUser || (targetUser as any).school_id !== (groupRow as any).school_id) {
    return NextResponse.json({ error: "User must be in the same school." }, { status: 400 });
  }

  const { data: row, error: insErr } = await admin
    .from("chat_group_members")
    .insert({
      group_id: groupId,
      user_id: userId,
      role: body.role === "admin" ? "admin" : "member",
    })
    .select(`
      *,
      profile:profiles!chat_group_members_user_id_fkey(id, full_name, role)
    `)
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "User is already a member." }, { status: 409 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ member: row as ChatGroupMember });
}

/**
 * DELETE /api/chat-groups/[id]/members?userId=...
 *
 * Removes a member from the group (or the caller leaves the group if
 * userId matches their own ID).
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const groupId = params.id;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "Missing userId param." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Self-removal (leave group) — always allowed.
  if (userId === user.id) {
    const { error: delErr } = await admin
      .from("chat_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", user.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, left: true });
  }

  // Removing someone else — must be admin.
  const { data: myMembership } = await admin
    .from("chat_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = (myMembership as any)?.role === "admin";
  if (!isAdmin) {
    // Also check school admin.
    const { data: groupRow } = await admin
      .from("chat_groups")
      .select("school_id")
      .eq("id", groupId)
      .single();
    const { data: callerRow } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    const caller = callerRow as { role: string; school_id: string | null } | null;
    const group = groupRow as { school_id: string } | null;
    const isSchoolAdmin =
      (caller?.role === "principal" || caller?.role === "staff") &&
      caller?.school_id === group?.school_id;
    if (!isSchoolAdmin) {
      return NextResponse.json({ error: "Only group admins can remove members." }, { status: 403 });
    }
  }

  const { error: delErr } = await admin
    .from("chat_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
