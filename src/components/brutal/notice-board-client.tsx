"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GlobalNotice } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * NoticeBoardClient — the client component for the Notice Board page.
 *
 * Has a publish form (title + content + publish_date) and a list of
 * existing notices with delete buttons.
 *
 * On publish → POST /api/notices → router.refresh() to show the new notice.
 * On delete → DELETE /api/notices/[id] → router.refresh().
 */
export function NoticeBoardClient({
  schoolId,
  initialNotices,
}: {
  schoolId: string;
  initialNotices: GlobalNotice[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          title: title.trim(),
          content: content.trim(),
          publishDate: publishDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setTitle("");
      setContent("");
      setPublishDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notice? It will be removed from all dashboards.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Publish form */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-amber-400" />
        <CardContent className="space-y-4 py-4">
          <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <Megaphone className="size-5" strokeWidth={2.5} />
            Publish a notice
          </h2>
          <form onSubmit={handlePublish} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notice-title">Title</Label>
              <Input
                id="notice-title"
                type="text"
                placeholder="e.g. School closed on Friday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-content">Content</Label>
              <Textarea
                id="notice-content"
                rows={3}
                placeholder="The full text of the notice — students, parents, and staff will see this at the top of their dashboard."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="notice-date">
                  <CalendarDays className="inline size-3.5" /> Publish date (optional)
                </Label>
                <Input
                  id="notice-date"
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                />
              </div>
              <Button type="submit" variant="amber" disabled={publishing}>
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Megaphone className="size-4" />
                )}
                Publish
              </Button>
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
              >
                {error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Existing notices */}
      <div className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight">
          Active notices ({initialNotices.length})
        </h2>
        {initialNotices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Megaphone className="mx-auto mb-2 size-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">
                No notices published yet
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Notices appear as a banner at the top of every user&apos;s dashboard.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {initialNotices.map((n) => (
              <Card key={n.id} className="overflow-hidden">
                <div className="h-1.5 w-full border-x-2 border-t-2 border-slate-900 bg-amber-400" />
                <CardContent className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
                        {n.title}
                      </h3>
                      <Badge variant="amber">{formatDate(n.publish_date)}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {n.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    disabled={deleting === n.id}
                    className="rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7] disabled:opacity-50"
                    aria-label="Delete notice"
                    title="Delete notice"
                  >
                    {deleting === n.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
