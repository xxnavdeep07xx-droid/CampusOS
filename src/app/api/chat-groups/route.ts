import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroup } from "@/lib/types";

/**
 * GET /api/chat-groups
 *
 * Returns all groups the caller is a member of, plus school-wide groups
 * (for principals/staff). Each group includes member_count, last_message,
 * and the caller's role.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Fetch the caller's groups via the members junction.
  const { data: memberships, error: mErr } = await admin
    .from("chat_group_members")
    .select("group_id, role")
    .eq("user_id", user.id);

  if (mErr) {
    if (/Could not find the table|does not exist/i.test(mErr.message)) {
      return NextResponse.json({ groups: [] });
    }
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const groupIds = (memberships as any[]).map((m) => m.group_id);
  const roleMap = new Map<string, string>();
  for (const m of memberships as any[]) {
    roleMap.set(m.group_id, m.role);
  }

  // Fetch the groups + their members + last message.
  const { data: groupRows } = await admin
    .from("chat_groups")
    .select("*")
    .in("id", groupIds)
    .order("updated_at", { ascending: false });

  const groups = (groupRows ?? []) as any[];

  // For each group, fetch member count + last message.
  const result = [];
  for (const g of groups) {
    const { count: memberCount } = await admin
      .from("chat_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", g.id);

    const { data: lastMsg } = await admin
      .from("chat_group_messages")
      .select(`
        id, group_id, sender_id, body, reply_to_id, created_at,
        sender:profiles!chat_group_messages_sender_id_fkey(id, full_name, role)
      `)
      .eq("group_id", g.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    (result as any[]).push({
      ...g,
      member_count: memberCount ?? 0,
      last_message: lastMsg ?? null,
      unread_count: 0, // TODO: implement read tracking
      my_role: roleMap.get(g.id) ?? "member",
    });
  }

  return NextResponse.json({ groups: result });
}

/**
 * POST /api/chat-groups
 *
 * Body: { name, description?, color?, memberIds? }
 *
 * Creates a new group + adds the caller as admin + adds initial members.
 * Only principals + teachers can create groups.
 */
export async function POST(request: Request) {
  let body: { name?: string; description?: string; color?: string; memberIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Verify caller is a principal or teacher.
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const profile = profileRow as { role: string; school_id: string | null } | null;
  if (!profile || !profile.school_id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }
  if (profile.role !== "principal" && profile.role !== "teacher") {
    return NextResponse.json(
      { error: "Only principals and teachers can create groups." },
      { status: 403 }
    );
  }

  // Create the group.
  const { data: group, error: gErr } = await admin
    .from("chat_groups")
    .insert({
      name,
      description: body.description?.trim() || null,
      created_by: user.id,
      school_id: profile.school_id,
      color: body.color ?? "bg-sky-400",
    })
    .select("*")
    .single();

  if (gErr) {
    if (/Could not find the table|does not exist/i.test(gErr.message)) {
      return NextResponse.json(
        { error: "The chat_groups table doesn't exist yet. Apply supabase/migrations/0015_chat_groups.sql first." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  // Add the creator as admin.
  const memberRows = [
    { group_id: group!.id, user_id: user.id, role: "admin" },
    ...(body.memberIds ?? []).map((uid) => ({
      group_id: group!.id,
      user_id: uid,
      role: "member" as const,
    })),
  ];

  const { error: mErr } = await admin
    .from("chat_group_members")
    .insert(memberRows);

  if (mErr) {
    console.warn("Failed to add members:", mErr.message);
  }

  return NextResponse.json({ group: group as ChatGroup });
}
