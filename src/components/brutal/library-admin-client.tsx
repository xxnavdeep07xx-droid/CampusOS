"use client";

import { useState } from "react";
import { Loader2, Plus, BookPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

/**
 * AddBookModal — modal for adding a new book to the library.
 */
export function AddBookModal({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [copies, setCopies] = useState("1");
  const [coverUrl, setCoverUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(""); setAuthor(""); setIsbn(""); setCopies("1"); setCoverUrl("");
    setError(null); setSaving(false);
  }
  function close() { setOpen(false); setTimeout(reset, 200); }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId, title: title.trim(), author: author.trim(),
          isbn: isbn.trim() || undefined, totalCopies: parseInt(copies) || 1,
          coverImageUrl: coverUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTimeout(reset, 200); }}>
      <DialogTrigger asChild>
        <Button variant="emerald"><Plus className="size-4" /> Add New Book</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookPlus className="size-5" /> Add a Book</DialogTitle>
          <DialogDescription>Enter the book details below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bk-title">Title *</Label>
            <Input id="bk-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. To Kill a Mockingbird" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bk-author">Author</Label>
            <Input id="bk-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Harper Lee" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bk-isbn">ISBN</Label>
              <Input id="bk-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-0-00-000000-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bk-copies">Total Copies</Label>
              <Input id="bk-copies" type="number" min={1} value={copies} onChange={(e) => setCopies(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bk-cover">Cover Image URL (optional)</Label>
            <Input id="bk-cover" type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
          </div>
          {error && (
            <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
          <Button variant="emerald" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <BookPlus className="size-4" />}
            Add Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * IssueDesk — scan-and-go style form for issuing/returning books.
 */
export function IssueDesk({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [issueStudentId, setIssueStudentId] = useState("");
  const [issueBookId, setIssueBookId] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!issueStudentId.trim() || !issueBookId.trim()) return;
    setIssuing(true); setIssueMsg(null);
    try {
      const res = await fetch("/api/book-issues", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: issueBookId.trim(), userId: issueStudentId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setIssueMsg({ type: "ok", text: "✓ Book issued successfully!" });
      setIssueStudentId(""); setIssueBookId("");
      router.refresh();
    } catch (err) {
      setIssueMsg({ type: "err", text: err instanceof Error ? err.message : String(err) });
    } finally { setIssuing(false); }
  }

  async function handleReturn(issueId: string) {
    try {
      const res = await fetch(`/api/book-issues/${issueId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setIssueMsg({ type: "err", text: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    issueStudentId, setIssueStudentId, issueBookId, setIssueBookId,
    issuing, issueMsg, handleIssue, handleReturn,
  };
}

export { IssueDesk };
