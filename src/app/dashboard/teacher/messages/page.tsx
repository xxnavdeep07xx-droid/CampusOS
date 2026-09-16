import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { MessagesClient } from "./messages-client";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/messages
 *
 * Direct-message inbox + conversation view. Two-pane layout:
 *   - Left: list of conversations (peer avatar + last message preview + unread badge)
 *   - Right: chronological message thread with input box at the bottom
 *
 * Supports ?peer=USER_ID deep-linking from the Staff Directory — opens the
 * conversation with that user directly.
 *
 * Realtime: client subscribes to direct_messages inserts filtered by
 * recipient_id = auth.uid() so new messages appear instantly.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ peer?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/messages");

  const sp = await searchParams;
  const initialPeerId = sp.peer?.trim() || null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const profile = profileRow as Profile | null;

  if (
    profile?.role !== "teacher" &&
    profile?.role !== "principal" &&
    profile?.role !== "staff" &&
    profile?.role !== "parent"
  ) {
    return (
      <div className="space-y-4">
        <Tag color="bg-rose-400">Access restricted</Tag>
        <p className="text-sm font-medium text-slate-700">
          Messaging is available to teachers, school staff, and parents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-sky-300">Messages</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Direct messages
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Secure, documented communication with other staff and parents in your
          school. New messages appear instantly — no refresh needed.
        </p>
      </div>

      <MessagesClient
        currentUserId={user.id}
        currentUserRole={profile?.role ?? null}
        initialPeerId={initialPeerId}
      />
    </div>
  );
}
