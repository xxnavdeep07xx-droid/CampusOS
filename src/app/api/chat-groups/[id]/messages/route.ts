import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroupMessage } from "@/lib/types";

/**
 * GET /api/chat-groups/[id]/messages?limit=50
 *
 * Returns messages for a group, most recent first (capped at 200).
 * Includes sender profile + reactions.
 *
 * Auth: caller must be a member of the group.
 */
export async function GET(
  request: Request,
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

  // Verify membership.
  const { data: membership } = await admin
    .from("chat_group_members")
    .select("group_id, role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    // Also allow school admins.
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

  const { data: messages, error } = await admin
    .from("chat_group_messages")
    .select(`
      *,
      sender:profiles!chat_group_messages_sender_id_fkey(id, full_name, role)
    `)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ messages: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch reactions for these messages.
  const messageIds = (messages ?? []).map((m: any) => m.id);
  let reactionsMap = new Map<string, { emoji: string; count: number; reactedByMe: boolean }[]>();
  if (messageIds.length > 0) {
    const { data: reactions } = await admin
      .from("chat_group_message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messageIds);
    for (const r of (reactions ?? []) as any[]) {
      if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, []);
      const list = reactionsMap.get(r.message_id)!;
      const existing = list.find((x) => x.emoji === r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === user.id) existing.reactedByMe = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, reactedByMe: r.user_id === user.id });
      }
    }
  }

  const messagesWithReactions = (messages ?? []).map((m: any) => ({
    ...m,
    reactions: reactionsMap.get(m.id) ?? [],
  })) as ChatGroupMessage[];

  return NextResponse.json({ messages: messagesWithReactions });
}

/**
 * POST /api/chat-groups/[id]/messages
 *
 * Body: { body, replyToId? }
 *
 * Sends a new message to the group.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const groupId = params.id;

  let body: { body?: string; replyToId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messageBody = body.body?.trim();
  if (!messageBody) return NextResponse.json({ error: "body is required." }, { status: 400 });
  if (messageBody.length > 5000) {
    return NextResponse.json({ error: "Message exceeds 5000 chars." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Verify membership.
  const { data: membership } = await admin
    .from("chat_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this group." }, { status: 403 });
  }

  const { data: row, error: insErr } = await admin
    .from("chat_group_messages")
    .insert({
      group_id: groupId,
      sender_id: user.id,
      body: messageBody,
      reply_to_id: body.replyToId?.trim() || null,
    })
    .select(`
      *,
      sender:profiles!chat_group_messages_sender_id_fkey(id, full_name, role)
    `)
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Touch the group's updated_at so it bubbles to the top of the groups list.
  await admin
    .from("chat_groups")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", groupId);

  return NextResponse.json({ message: row as ChatGroupMessage });
}

/**
 * DELETE /api/chat-groups/[id]
 *
 * Permanently deletes a group (cascade deletes members + messages).
 * Only the creator or school admin can delete.
 */
export async function DELETE(
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

  const { data: group } = await admin
    .from("chat_groups")
    .select("created_by, school_id")
    .eq("id", groupId)
    .single();

  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const { data: callerRow } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  const caller = callerRow as { role: string; school_id: string | null } | null;

  const isCreator = (group as any).created_by === user.id;
  const isSchoolAdmin =
    (caller?.role === "principal" || caller?.role === "staff") &&
    caller?.school_id === (group as any).school_id;

  if (!isCreator && !isSchoolAdmin) {
    return NextResponse.json({ error: "Only the group creator or school admin can delete." }, { status: 403 });
  }

  const { error: delErr } = await admin.from("chat_groups").delete().eq("id", groupId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
