import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tag } from "@/components/brutal/section";
import { NotificationsClient } from "./notifications-client";
import type { Profile, Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /dashboard/teacher/notifications
 *
 * Unified notification inbox — aggregates events from across the app:
 *   - Assignment submissions waiting to be graded
 *   - Direct messages from staff/parents
 *   - Leave request status changes (approved/rejected)
 *   - Announcements posted to your classes (by co-teachers/admins)
 *   - Behavior incidents logged on your students (by admins)
 *
 * Realtime: client subscribes to notification INSERT events filtered by
 * recipient_id so new notifications appear instantly without refresh.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/teacher/notifications");

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
          Notifications are available to teachers, school staff, and parents.
        </p>
      </div>
    );
  }

  // Initial fetch — most recent 50 notifications.
  const { data: notifRows, error } = await supabase
    .from("notifications")
    .select(`
      *,
      actor:profiles!notifications_actor_id_fkey(id, full_name, role)
    `)
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  let notifications: Notification[] = [];
  if (!error && notifRows) {
    notifications = notifRows as Notification[];
  }

  // Unread count for the header badge.
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag color="bg-amber-300">Notifications</Tag>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
          Your inbox
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Everything that needs your attention — submissions, messages, leave
          updates, and more. New notifications appear instantly — no refresh needed.
        </p>
      </div>

      <NotificationsClient
        currentUserId={user.id}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount ?? 0}
        migrationMissing={!!error && /Could not find the table|does not exist/i.test(error.message)}
      />
    </div>
  );
}
