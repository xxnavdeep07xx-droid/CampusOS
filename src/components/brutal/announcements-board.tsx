"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Inbox,
  Loader2,
  Megaphone,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { announcementTagMeta, type Announcement, type AnnouncementTag, type Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * AnnouncementsBoard — the announcements tab of the class feed.
 *
 * Fetches announcements via GET /api/announcements?classId=X, renders them
 * as Neo-brutalist cards with tag badges (color-coded per tag) + pinned
 * items sorted to the top.
 *
 * - Teachers can create new announcements (modal with title/content/tag/pin).
 * - Teachers can toggle pin + delete.
 * - Students see everything read-only.
 *
 * Realtime: subscribes to postgres_changes on the announcements table
 * (INSERT/UPDATE/DELETE filtered by class_id) so new announcements appear
 * live without a manual refresh.
 */
export function AnnouncementsBoard({
  classId,
  profile,
}: {
  classId: string;
  profile: Profile;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isTeacher =
    profile.role === "teacher" || profile.role === "principal" || profile.role === "staff";

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements?classId=${classId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setAnnouncements(json.announcements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements, refreshKey]);

  // Realtime subscription — listen for INSERT/UPDATE/DELETE on
  // announcements for this class.
  useEffect(() => {
    let channel: ReturnType<typeof import("@/lib/supabase/browser").createClient>["channel"] | null = null;
    let unsubFn: (() => void) | null = null;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/browser");
        const supabase = createClient();
        channel = supabase
          .channel(`announcements:${classId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "announcements",
              filter: `class_id=eq.${classId}`,
            },
            () => {
              // Refetch on any change — simplest + safest approach.
              setRefreshKey((k) => k + 1);
            }
          )
          .subscribe();
        unsubFn = () => supabase.removeChannel(channel!);
      } catch (err) {
        // Realtime may not be available if env vars are missing — tolerate.
        console.warn("Realtime subscription failed:", err);
      }
    })();

    return () => {
      if (unsubFn) unsubFn();
    };
  }, [classId]);

  async function handleTogglePin(id: string, currentlyPinned: boolean) {
    // Optimistic update.
    setAnnouncements((prev) =>
      prev
        .map((a) =>
          a.id === id ? { ...a, is_pinned: !currentlyPinned } : a
        )
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return b.created_at.localeCompare(a.created_at);
        })
    );
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !currentlyPinned }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
    } catch (err) {
      // Revert on failure.
      setRefreshKey((k) => k + 1);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      setRefreshKey((k) => k + 1);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <Megaphone className="size-5" strokeWidth={2.5} />
            Announcements
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            {announcements.length} {announcements.length === 1 ? "announcement" : "announcements"}
            {announcements.some((a) => a.is_pinned) && " · pinned on top"}
          </p>
        </div>
        {isTeacher && (
          <CreateAnnouncementModal
            classId={classId}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-4 py-6 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
          <Loader2 className="size-4 animate-spin" />
          Loading announcements…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
        >
          <AlertCircle className="mr-2 inline size-4" />
          {error}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-sky-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <Inbox className="size-6 text-slate-900" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No announcements yet
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {isTeacher
                ? "Post your first announcement — students will see it instantly."
                : "Your teacher hasn't posted any announcements yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {announcements.map((a) => {
            const tag = announcementTagMeta(a.tag);
            const authorName = a.author?.full_name ?? "Unknown";
            const isAuthor = a.author_id === profile.id;
            return (
              <Card
                key={a.id}
                className={cn(
                  "overflow-hidden",
                  a.is_pinned && "border-emerald-500 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]"
                )}
              >
                {/* Accent bar (color matches tag) */}
                <div className={cn("h-1.5 w-full border-x-2 border-t-2 border-slate-900", tag.bgClass)} />
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
                          tag.bgClass,
                          tag.textClass
                        )}
                      >
                        {tag.emoji} {tag.label}
                      </span>
                      {a.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full border-2 border-slate-900 bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FDFBF7] shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                          <Pin className="size-3" />
                          Pinned
                        </span>
                      )}
                    </div>
                    {isTeacher && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(a.id, a.is_pinned)}
                          className="rounded-lg border-2 border-slate-900 bg-white p-1.5 transition-all hover:bg-amber-100"
                          aria-label={a.is_pinned ? "Unpin" : "Pin to top"}
                          title={a.is_pinned ? "Unpin" : "Pin to top"}
                        >
                          {a.is_pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7]"
                          aria-label="Delete announcement"
                          title="Delete announcement"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                    {a.title}
                  </h3>
                  {a.content && (
                    <p className="whitespace-pre-line text-sm font-medium text-slate-700">
                      {a.content}
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t-2 border-slate-100 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>By {authorName}{isAuthor && " (you)"}</span>
                    <span>{formatDateTime(a.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Create Announcement modal
// ============================================================

function CreateAnnouncementModal({
  classId,
  onCreated,
}: {
  classId: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState<AnnouncementTag>("general");
  const [isPinned, setIsPinned] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setContent("");
    setTag("general");
    setIsPinned(false);
    setCreating(false);
    setError(null);
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleCreate() {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: title.trim(),
          content: content.trim(),
          tag,
          isPinned,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      onCreated?.();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="sky">
          <Plus className="size-4" />
          New announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post an announcement</DialogTitle>
          <DialogDescription>
            Students see new announcements instantly — no refresh needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              type="text"
              placeholder="e.g. Quiz moved to Friday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ann-content">Body (optional)</Label>
            <Textarea
              id="ann-content"
              rows={4}
              placeholder="Add details, links, instructions…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ann-tag">Tag</Label>
              <Select value={tag} onValueChange={(v) => setTag(v as AnnouncementTag)}>
                <SelectTrigger id="ann-tag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="assignment">Assignment Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-pin">Pin to top?</Label>
              <button
                type="button"
                id="ann-pin"
                onClick={() => setIsPinned((p) => !p)}
                className={cn(
                  "flex h-11 w-full items-center justify-between rounded-xl border-2 border-slate-900 px-4 text-sm font-bold uppercase tracking-wider transition-all",
                  isPinned
                    ? "bg-emerald-500 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(5,150,105,1)]"
                    : "bg-white text-slate-900 hover:bg-amber-100"
                )}
              >
                {isPinned ? "Pinned ✓" : "Not pinned"}
                <Pin className="size-4" />
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
            >
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="sky"
            onClick={handleCreate}
            disabled={creating || !title.trim()}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Posting…
              </>
            ) : (
              <>
                <Megaphone className="size-4" />
                Post announcement
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
