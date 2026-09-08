"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function IssueDeskForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [bookId, setBookId] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId.trim() || !bookId.trim()) return;
    setIssuing(true); setMsg(null);
    try {
      const res = await fetch("/api/book-issues", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: bookId.trim(), userId: studentId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setMsg({ type: "ok", text: "✓ Book issued successfully!" });
      setStudentId(""); setBookId("");
      router.refresh();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : String(err) });
    } finally { setIssuing(false); }
  }

  return (
    <form onSubmit={handleIssue} className="space-y-3 rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="iss-student">Student / Staff ID</Label>
          <Input id="iss-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Paste a profile UUID" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="iss-book">Book ID</Label>
          <Input id="iss-book" value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder="Paste a book UUID" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="emerald" disabled={issuing || !studentId.trim() || !bookId.trim()}>
          {issuing ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
          Issue Book
        </Button>
        {msg && (
          <span className={msg.type === "ok" ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-rose-700"}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
