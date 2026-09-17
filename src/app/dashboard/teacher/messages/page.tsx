import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { MessagesPageClient } from "./messages-page-client";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/messages
 *
 * Two messaging modes via tabs:
 *   1. Direct Messages — 1:1 chat (existing)
 *   2. Group Chats — multi-person groups (new — principals + teachers can create)
 *
 * Supports ?peer=USER_ID for DM deep-linking + ?tab=groups for direct
 * group access.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ peer?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/messages");

  const sp = await searchParams;
  const initialPeerId = sp.peer?.trim() || null;
  const initialTab = sp.tab === "groups" ? "groups" : "dms";

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

  // Fetch staff list for the group member picker (same school).
  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("school_id", profile?.school_id ?? "")
    .in("role", ["teacher", "principal", "staff", "parent"])
    .neq("id", user.id)
    .order("full_name", { ascending: true });
  const staffList = (staffRows ?? []) as { id: string; full_name: string; role: string }[];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-sky-300">Messages</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Messages
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Direct messages and group chats with staff and parents in your school.
          New messages appear instantly — no refresh needed.
        </p>
      </div>

      <MessagesPageClient
        currentUserId={user.id}
        currentUserRole={profile?.role ?? null}
        initialPeerId={initialPeerId}
        initialTab={initialTab}
        staffList={staffList}
      />
    </div>
  );
}
