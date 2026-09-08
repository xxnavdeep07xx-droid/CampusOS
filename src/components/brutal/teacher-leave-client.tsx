"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Send, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LeaveRequest, LeaveStatus } from "@/lib/types";
import { leaveStatusBgClass, leaveStatusLabel } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * TeacherLeaveClient — the full teacher leave page:
 *   1. Request form (start_date, end_date, reason → POST /api/leave-requests)
 *   2. History list (past requests with status badges)
 */
export function TeacherLeaveClient({
  schoolId,
  initialRequests,
}: {
  schoolId: string;
  initialRequests: LeaveRequest[];
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) { setError("Both dates are required."); return; }
    if (startDate > endDate) { setError("Start date must be before or equal to end date."); return; }
    setSubmitting(true); setError(null); setSuccess(false);
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, startDate, endDate, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setSuccess(true);
      setStartDate(""); setEndDate(""); setReason("");
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      {/* Request form */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-amber-400" />
        <CardContent className="space-y-4 py-4">
          <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <CalendarDays className="size-5" strokeWidth={2.5} /> Request Leave
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lr-start">Start Date</Label>
                <Input id="lr-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lr-end">End Date</Label>
                <Input id="lr-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lr-reason">Reason (optional)</Label>
              <Textarea id="lr-reason" rows={3} placeholder="e.g. Family emergency, medical appointment…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="amber" disabled={submitting || !startDate || !endDate}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Submit Request
              </Button>
              {success && <span className="text-xs font-bold text-emerald-700">✓ Request submitted!</span>}
              {error && <span className="text-xs font-bold text-rose-700">{error}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
          <ClipboardList className="size-5" strokeWidth={2.5} /> My Leave History ({initialRequests.length})
        </h2>
        {initialRequests.length === 0 ? (
          <Card><CardContent className="py-8 text-center">
            <ClipboardList className="mx-auto mb-2 size-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-700">No leave requests yet</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Submit a request above and it will appear here.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {initialRequests.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <div className={cn("h-1.5 w-full border-x-2 border-t-2 border-slate-900", leaveStatusBgClass(r.status as LeaveStatus))} />
                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <span>{formatDate(r.start_date)}</span>
                      <span className="text-slate-400">→</span>
                      <span>{formatDate(r.end_date)}</span>
                    </div>
                    {r.reason && <p className="mt-1 text-xs font-medium text-slate-600">{r.reason}</p>}
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Submitted {formatDateTime(r.created_at)}
                      {r.reviewed_at && ` · Reviewed ${formatDateTime(r.reviewed_at)}`}
                    </p>
                  </div>
                  <span className={cn(
                    "inline-flex items-center rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
                    leaveStatusBgClass(r.status as LeaveStatus)
                  )}>
                    {leaveStatusLabel(r.status as LeaveStatus)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
