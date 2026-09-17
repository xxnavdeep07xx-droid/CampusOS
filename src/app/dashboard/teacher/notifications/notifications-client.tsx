"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardList,
  Inbox,
  Mail,
  Megaphone,
  MessageCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Notification, NotificationType } from "@/lib/types";
import { timeAgo, formatDateTime } from "@/lib/storage";

const TYPE_META: Record<NotificationType, { label: string; icon: React.ReactNode; barClass: string; bgClass: string }> = {
  submission: {
    label: "Submission",
    icon: <ClipboardList className="size-4" />,
    barClass: "bg-amber-400",
    bgClass: "bg-amber-100",
  },
  quiz_submission: {
    label: "Quiz attempt",
    icon: <ClipboardList className="size-4" />,
    barClass: "bg-amber-400",
    bgClass: "bg-amber-100",
  },
  direct_message: {
    label: "Message",
    icon: <MessageCircle className="size-4" />,
    barClass: "bg-sky-400",
    bgClass: "bg-sky-100",
  },
  leave_request: {
    label: "Leave",
    icon: <Mail className="size-4" />,
    barClass: "bg-violet-400",
    bgClass: "bg-violet-100",
  },
  announcement: {
    label: "Announcement",
    icon: <Megaphone className="size-4" />,
    barClass: "bg-emerald-400",
    bgClass: "bg-emerald-100",
  },
  behavior_incident: {
    label: "Behavior",
    icon: <AlertCircle className="size-4" />,
    barClass: "bg-rose-400",
    bgClass: "bg-rose-100",
  },
  resource_shared: {
    label: "Shared",
    icon: <Sparkles className="size-4" />,
    barClass: "bg-violet-400",
    bgClass: "bg-violet-100",
  },
  assignment_created: {
    label: "Assignment",
    icon: <ClipboardList className="size-4" />,
    barClass: "bg-rose-400",
    bgClass: "bg-rose-100",
  },
  quiz_published: {
    label: "Quiz",
    icon: <Sparkles className="size-4" />,
    barClass: "bg-rose-400",
    bgClass: "bg-rose-100",
  },
};

/**
 * NotificationsClient
 *
 * Renders the notification inbox with:
 *   - Filter tabs (All / Unread)
 *   - "Mark all as read" button
 *   - Per-notification row with type icon, title, body preview, time-ago,
 *     deep-link, and mark-as-read / delete actions.
 *
 * Realtime: subscribes to notification INSERT events filtered by
 * recipient_id, so new notifications appear at the top of the list
 * without a page refresh.
 */
export function NotificationsClient({
  currentUserId,
  initialNotifications,
  initialUnreadCount,
  migrationMissing,
}: {
  currentUserId: string;
  initialNotifications: Notification[];
  initialUnreadCount: number;
  migrationMissing: boolean;
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=50", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, []);

  // Realtime: subscribe to new notifications for this user.
  useEffect(() => {
    let channel: any = null;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/browser");
        const supabase = createClient();
        channel = supabase
          .channel(`notifications:${currentUserId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `recipient_id=eq.${currentUserId}`,
            },
            () => {
              // Refetch the inbox (simplest + safest — avoids manually merging)
              fetchNotifications();
            }
          )
          .subscribe();
        unsub = () => supabase.removeChannel(channel);
      } catch (err) {
        console.warn("Realtime subscription failed:", err);
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [currentUserId, fetchNotifications, refreshKey]);

  async function handleMarkRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
    } catch (err) {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: null } : n))
      );
      setUnreadCount((prev) => prev + 1);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification?")) return;
    const target = notifications.find((n) => n.id === id);
    // Optimistic removal
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target?.read_at === null) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed (HTTP ${res.status})`);
    } catch (err) {
      // Revert on failure
      if (target) {
        setNotifications((prev) => [target, ...prev]);
        if (target.read_at === null) setUnreadCount((prev) => prev + 1);
      }
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      // Update local state
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
      setUnreadCount(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setMarkingAllRead(false);
    }
  }

  if (migrationMissing) {
    return (
      <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
        <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
        <CardContent className="space-y-2 py-5">
          <h3 className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-amber-700">
            <AlertTriangle className="size-4" /> Phase 12 migration needed
          </h3>
          <p className="text-sm font-medium text-slate-700">
            The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">notifications</code> table
            doesn&apos;t exist yet.
          </p>
          <p className="text-xs font-medium text-slate-600">
            Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0012_notifications.sql</code>
            {" "}via the Supabase SQL editor.
          </p>
        </CardContent>
      </Card>
    );
  }

  const visible = filter === "unread"
    ? notifications.filter((n) => n.read_at === null)
    : notifications;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-1">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")} count={notifications.length}>
            All
          </FilterButton>
          <FilterButton active={filter === "unread"} onClick={() => setFilter("unread")} count={unreadCount}>
            Unread
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          )}
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
            >
              {markingAllRead ? (
                <>
                  <Bell className="size-3.5 animate-pulse" />
                  Marking…
                </>
              ) : (
                <>
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              {filter === "unread" ? "All caught up!" : "No notifications yet"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {filter === "unread"
                ? "You have no unread notifications. Nice work."
                : "Notifications will appear here when students submit, parents message you, or leave requests are approved."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onMarkRead={() => handleMarkRead(n.id)}
              onDelete={() => handleDelete(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
        active
          ? "bg-slate-900 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
          : "bg-white text-slate-700 hover:bg-amber-50"
      )}
    >
      {children}
      <span
        className={cn(
          "ml-1 rounded-full px-1.5 text-[10px]",
          active ? "bg-[#FDFBF7]/20" : "bg-slate-100"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[notification.type] ?? TYPE_META.submission;
  const isUnread = notification.read_at === null;
  const actorName = (notification as any).actor?.full_name;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        isUnread
          ? "border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
          : "border-slate-200 opacity-75"
      )}
    >
      <div className={cn("flex h-1.5 w-full border-x-2 border-t-2 border-slate-900", meta.barClass)} />
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900",
              meta.bgClass
            )}
          >
            {meta.icon}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {meta.label}
              </span>
              {isUnread && (
                <span className="flex items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#FDFBF7]">
                  New
                </span>
              )}
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400" title={formatDateTime(notification.created_at)}>
                {timeAgo(notification.created_at)}
              </span>
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {notification.title}
            </div>
            {notification.body && (
              <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-600">
                {notification.body}
              </p>
            )}
            {actorName && (
              <div className="mt-1 text-[10px] font-medium text-slate-500">
                by {actorName}
              </div>
            )}

            {/* Actions */}
            <div className="mt-2 flex items-center gap-2">
              {notification.link_url && (
                <Link
                  href={notification.link_url}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-amber-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                  onClick={() => {
                    // Mark as read when the user clicks through
                    if (isUnread) onMarkRead();
                  }}
                >
                  View →
                </Link>
              )}
              {isUnread && (
                <button
                  type="button"
                  onClick={onMarkRead}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 hover:bg-emerald-200"
                >
                  <CheckCheck className="size-3" />
                  Mark read
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700"
                aria-label="Delete notification"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
