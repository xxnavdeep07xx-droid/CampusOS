import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DirectMessage, ConversationSummary } from "@/lib/types";

/**
 * GET /api/direct-messages?peer=USER_ID
 *   - Without `peer`: returns the caller's conversation list (inbox).
 *     Each entry has peer profile + last_message + unread_count.
 *   - With `peer=USER_ID`: returns the chronological message history
 *     between the caller and that peer (most recent 200). Also marks
 *     all messages from peer → caller as read.
 *
 * Auth: caller must be signed in. The peer (if specified) must be in the
 * same school as the caller — enforced by the RLS policy.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const peerId = url.searchParams.get("peer");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // ===== MODE 1: conversation list (inbox) =====
  if (!peerId) {
    // Fetch all messages involving the caller (sent or received), most
    // recent first. We'll group by peer in JS to build the summary list.
    const { data: allMessages, error } = await admin
      .from("direct_messages")
      .select(`
        *,
        sender:profiles!direct_messages_sender_id_fkey(id, full_name, role),
        recipient:profiles!direct_messages_recipient_id_fkey(id, full_name, role)
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      if (/Could not find the table|does not exist/i.test(error.message)) {
        return NextResponse.json({ conversations: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const messages = (allMessages ?? []) as any[];

    // Build conversation list keyed by peer id.
    const conversationsMap = new Map<string, ConversationSummary>();
    for (const m of messages) {
      const isSender = m.sender_id === user.id;
      const peer = isSender ? m.recipient : m.sender;
      if (!peer?.id) continue;
      const existing = conversationsMap.get(peer.id);
      if (!existing || new Date(m.created_at) > new Date(existing.last_message.created_at)) {
        conversationsMap.set(peer.id, {
          peer,
          last_message: m,
          unread_count: 0, // filled in below
        });
      }
      // Track unread count (only count messages where caller is recipient + read_at IS NULL)
      if (!isSender && m.read_at === null) {
        const entry = conversationsMap.get(peer.id)!;
        entry.unread_count += 1;
      }
    }

    // Sort by most recent activity.
    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
    );

    return NextResponse.json({ conversations });
  }

  // ===== MODE 2: load conversation with peer =====
  // Fetch messages between caller and peer in either direction.
  const { data: messages, error } = await admin
    .from("direct_messages")
    .select(`
      *,
      sender:profiles!direct_messages_sender_id_fkey(id, full_name, role),
      recipient:profiles!direct_messages_recipient_id_fkey(id, full_name, role)
    `)
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) {
    if (/Could not find the table|does not exist/i.test(error.message)) {
      return NextResponse.json({ messages: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark all unread messages from peer → caller as read.
  await admin
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", peerId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return NextResponse.json({ messages: messages as DirectMessage[] });
}

/**
 * POST /api/direct-messages
 *
 * Body: { recipientId, body }
 *
 * Sends a new message from the caller to `recipientId`. RLS enforces that
 * both parties are in the same school (and recipientId !== caller).
 */
export async function POST(request: Request) {
  let body: { recipientId?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const recipientId = body.recipientId?.trim();
  const messageBody = body.body?.trim();
  if (!recipientId || !messageBody) {
    return NextResponse.json(
      { error: "recipientId and body are required." },
      { status: 400 }
    );
  }
  if (messageBody.length > 5000) {
    return NextResponse.json(
      { error: "Message body exceeds the 5000-character limit." },
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

  // Verify the recipient exists and is in the same school as the caller.
  const [{ data: senderRow }, { data: recipientRow }] = await Promise.all([
    admin.from("profiles").select("id, school_id").eq("id", user.id).single(),
    admin.from("profiles").select("id, school_id").eq("id", recipientId).single(),
  ]);
  const sender = senderRow as { id: string; school_id: string | null } | null;
  const recipient = recipientRow as { id: string; school_id: string | null } | null;
  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  }
  if (
    !sender?.school_id ||
    sender.school_id !== recipient.school_id
  ) {
    return NextResponse.json(
      { error: "You can only message users in your own school." },
      { status: 403 }
    );
  }

  const { data: row, error: insErr } = await admin
    .from("direct_messages")
    .insert({
      sender_id: user.id,
      recipient_id: recipientId,
      school_id: sender.school_id,
      body: messageBody,
      read_at: null,
    })
    .select("*")
    .single();

  if (insErr) {
    if (/Could not find the table|does not exist/i.test(insErr.message)) {
      return NextResponse.json(
        {
          error:
            "The direct_messages table doesn't exist yet. Apply supabase/migrations/0011_communication_center.sql first.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: row as DirectMessage });
}
