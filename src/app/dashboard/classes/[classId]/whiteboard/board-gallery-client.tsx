"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  PencilRuler,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { publicStorageUrl, CLASS_MATERIALS_BUCKET, formatDate, timeAgo } from "@/lib/storage";
import type { WhiteboardBoard } from "@/lib/types";

type BoardWithCreator = WhiteboardBoard & {
  creator?: { id: string; full_name: string } | null;
};

/**
 * WhiteboardBoardGallery
 *
 * Grid of saved boards + "New board" creation modal.
 */
export function WhiteboardBoardGallery({
  classId,
  initialBoards,
  canEdit,
  migrationMissing,
}: {
  classId: string;
  initialBoards: BoardWithCreator[];
  canEdit: boolean;
  migrationMissing: boolean;
}) {
  const [boards, setBoards] = useState<BoardWithCreator[]>(initialBoards);

  async function handleCreate(name: string) {
    try {
      const res = await fetch("/api/whiteboard-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      // Navigate to the new board.
      window.location.href = `/dashboard/classes/${classId}/whiteboard?board=${json.board.id}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(boardId: string, name: string) {
    if (!confirm(`Delete "${name}"? This permanently removes the board + all its strokes. This cannot be undone.`)) return;
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    try {
      const res = await fetch(`/api/whiteboard-boards/${boardId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      // Revert — re-fetch
      window.location.reload();
    }
  }

  if (migrationMissing) {
    return (
      <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
        <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
        <CardContent className="space-y-2 py-5">
          <h3 className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-amber-700">
            <AlertTriangle className="size-4" /> Phase 13 migration needed
          </h3>
          <p className="text-sm font-medium text-slate-700">
            The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">whiteboard_boards</code> table
            doesn&apos;t exist yet.
          </p>
          <p className="text-xs font-medium text-slate-600">
            Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0013_whiteboard_boards.sql</code>
            {" "}via the Supabase SQL editor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-tight">
          {boards.length} {boards.length === 1 ? "board" : "boards"}
        </h2>
        {canEdit && <CreateBoardModal onCreate={handleCreate} />}
      </div>

      {boards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PencilRuler className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              {canEdit ? "No boards yet" : "Your teacher hasn't created any boards yet"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {canEdit
                ? "Click 'New board' above to create your first whiteboard."
                : "Check back later."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              classId={classId}
              canEdit={canEdit}
              onDelete={() => handleDelete(board.id, board.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCard({
  board,
  classId,
  canEdit,
  onDelete,
}: {
  board: BoardWithCreator;
  classId: string;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const thumbnailUrl = board.thumbnail_path
    ? publicStorageUrl(CLASS_MATERIALS_BUCKET, board.thumbnail_path)
    : null;
  const creatorName = board.creator?.full_name ?? "Unknown";

  return (
    <div className="group overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
      {/* Thumbnail */}
      <Link
        href={`/dashboard/classes/${classId}/whiteboard?board=${board.id}`}
        className="block aspect-video overflow-hidden border-b-2 border-slate-900 bg-slate-100"
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={board.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PencilRuler className="size-8 text-slate-300" />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-3">
        <Link
          href={`/dashboard/classes/${classId}/whiteboard?board=${board.id}`}
          className="block truncate text-sm font-black uppercase tracking-tight text-slate-900 hover:text-slate-700"
        >
          {board.name}
        </Link>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <CalendarClock className="size-3" />
          {timeAgo(board.updated_at)}
        </div>
        <div className="text-[10px] font-medium text-slate-400">
          by {creatorName}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="mt-2 flex items-center gap-2 border-t-2 border-slate-100 pt-2">
            <Link
              href={`/dashboard/classes/${classId}/whiteboard?board=${board.id}`}
              className="flex-1 rounded-lg border-2 border-slate-900 bg-sky-300 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-900 transition-all hover:bg-sky-400"
            >
              Open
            </Link>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-lg border-2 border-slate-300 bg-white p-1.5 text-slate-500 hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700"
                aria-label="Delete board"
              >
                <Trash2 className="size-3" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded border-2 border-rose-500 bg-rose-500 px-1.5 py-1 text-[9px] font-bold uppercase text-[#FDFBF7]"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded border-2 border-slate-300 bg-white px-1.5 py-1 text-[9px] font-bold uppercase text-slate-600"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateBoardModal({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setOpen(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setName(""); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="sky" size="sm">
          <Plus className="size-4" />
          New board
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new whiteboard</DialogTitle>
          <DialogDescription>
            Give it a name — e.g. &ldquo;Algebra Ch.3&rdquo; or &ldquo;Geometry review&rdquo;.
            You can rename it later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="board-name">Board name</Label>
          <Input
            id="board-name"
            type="text"
            placeholder="e.g. Algebra Ch.3 — Quadratic equations"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            autoFocus
            disabled={creating}
            maxLength={100}
          />
          {error && (
            <p className="text-xs font-bold text-rose-600">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="sky" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Create board
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
