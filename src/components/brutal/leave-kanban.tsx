"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LeaveRequest, LeaveStatus } from "@/lib/types";
import { leaveStatusBgClass, leaveStatusLabel } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * LeaveRequestKanban — a 3-column visual Kanban board for leave requests.
 * Columns: Pending (amber), Approved (emerald), Rejected (rose).
 * Clicking a Pending card opens a modal to approve/reject.
 */
export function LeaveRequestKanban({
  initialRequests,
}: {
  initialRequests: LeaveRequest[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    await handleReview(id, "approved");
  }
  async function handleReject(id: string) {
    await handleReview(id, "rejected");
  }

  async function handleReview(id: string, status: LeaveStatus) {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      // Update local state.
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      setSelected(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setProcessing(false); }
  }

  const columns: { status: LeaveStatus; label: string; color: string }[] = [
    { status: "pending", label: "Pending", color: "bg-amber-400" },
    { status: "approved", label: "Approved", color: "bg-emerald-500" },
    { status: "rejected", label: "Rejected", color: "bg-rose-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Kanban columns */}
      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((col) => {
          const items = requests.filter((r) => r.status === col.status);
          return (
            <div key={col.status} className="space-y-3">
              {/* Column header */}
              <div className={cn(
                "flex items-center justify-between rounded-xl border-2 border-slate-900 px-4 py-2 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]",
                col.color
              )}>
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {col.label}
                </span>
                <span className="rounded-full border-2 border-slate-900 bg-white px-2 py-0.5 text-[10px] font-black text-slate-900">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[100px]">
                {items.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-300 py-6 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No items</p>
                  </div>
                ) : (
                  items.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all",
                        col.status === "pending" && "cursor-pointer hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                      )}
                      onClick={() => col.status === "pending" && setSelected(r)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                          {(r.staff?.full_name || "?").slice(0, 2)}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{r.staff?.full_name ?? "Unknown"}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <span>{formatDate(r.start_date)}</span>
                        <span>→</span>
                        <span>{formatDate(r.end_date)}</span>
                      </div>
                      {r.reason && (
                        <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-600">{r.reason}</p>
                      )}
                      {r.reviewed_at && (
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Reviewed {formatDateTime(r.reviewed_at)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Approve/Reject modal */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
            <DialogDescription>{selected?.staff?.full_name}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="rounded-xl border-2 border-slate-200 bg-[#FDFBF7] p-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dates</div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  {formatDate(selected.start_date)} → {formatDate(selected.end_date)}
                </div>
              </div>
              {selected.reason && (
                <div className="rounded-xl border-2 border-slate-200 bg-[#FDFBF7] p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reason</div>
                  <p className="mt-1 text-sm font-medium text-slate-700">{selected.reason}</p>
                </div>
              )}
              {error && (
                <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]">
                  {error}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={processing}>Cancel</Button>
            <Button variant="coral" onClick={() => selected && handleReject(selected.id)} disabled={processing}>
              {processing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Reject
            </Button>
            <Button variant="emerald" onClick={() => selected && handleApprove(selected.id)} disabled={processing}>
              {processing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
