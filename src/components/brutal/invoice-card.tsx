"use client";

import { useState } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  Receipt,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/brutal/section";
import {
  formatCurrency,
  invoiceStatusBgClass,
  invoiceStatusLabel,
  type FeeInvoice,
  type InvoiceStatus,
} from "@/lib/types";
import { formatDate } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * InvoiceCard — receipt-style card for a single fee invoice.
 *
 * Visual contract (per Phase 6 spec):
 *   - Stark white background
 *   - Thick black borders (border-[3px] border-slate-900)
 *   - Dashed divider line above the total amount
 *   - Large, bold typography for the pricing
 *   - Status badge with financial-state colors:
 *     paid=emerald, overdue=rose, pending=amber
 *   - "Pay Now" button on pending/overdue invoices → opens PayNowModal
 *
 * If `onPaid` is provided, it's called after a successful mock payment
 * so the parent can refresh their invoice list.
 */
export function InvoiceCard({
  invoice,
  studentName,
  canPay = true,
  onPaid,
}: {
  invoice: FeeInvoice;
  studentName?: string;
  canPay?: boolean;
  onPaid?: () => void;
}) {
  const [payOpen, setPayOpen] = useState(false);

  const status = invoice.status as InvoiceStatus;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-white shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] transition-all hover:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
        {/* Receipt header */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-[#FDFBF7]">
          <div className="flex items-center gap-2">
            <Receipt className="size-4" strokeWidth={2.5} />
            <span className="text-xs font-black uppercase tracking-wider">
              Invoice
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
              invoiceStatusBgClass(status)
            )}
          >
            {invoiceStatusLabel(status)}
          </span>
        </div>

        {/* Receipt body */}
        <div className="space-y-3 p-4">
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
              {invoice.title}
            </h3>
            {invoice.description && (
              <p className="mt-0.5 text-xs font-medium text-slate-600">
                {invoice.description}
              </p>
            )}
          </div>

          {studentName && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Building2 className="size-3.5 text-slate-500" />
              {studentName}
            </div>
          )}

          {invoice.due_date && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <CalendarClock className="size-3.5 text-slate-500" />
              Due {formatDate(invoice.due_date)}
            </div>
          )}

          {/* Dashed divider + total */}
          <div className="border-t-2 border-dashed border-slate-900 pt-3">
            <div className="flex items-end justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Total Due
              </span>
              <span className="font-mono text-3xl font-black tabular-nums text-slate-900">
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>
          </div>

          {/* Pay Now button */}
          {canPay && status !== "paid" && (
            <Button
              type="button"
              variant="emerald"
              size="lg"
              className="w-full"
              onClick={() => setPayOpen(true)}
            >
              <CreditCard className="size-4" />
              Pay Now
            </Button>
          )}

          {status === "paid" && (
            <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="size-4" />
              Payment received — thank you!
            </div>
          )}
        </div>
      </div>

      <PayNowModal
        open={payOpen}
        onOpenChange={setPayOpen}
        invoice={invoice}
        studentName={studentName}
        onPaid={onPaid}
      />
    </>
  );
}

// ============================================================
// Mock checkout modal
// ============================================================

function PayNowModal({
  open,
  onOpenChange,
  invoice,
  studentName,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: FeeInvoice;
  studentName?: string;
  onPaid?: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amountPaid: invoice.total_amount,
          paymentMethod: "mock_card",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setSuccess(true);
      setTimeout(() => {
        onPaid?.();
        onOpenChange(false);
        // Reset after close animation.
        setTimeout(() => {
          setSuccess(false);
          setProcessing(false);
        }, 200);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProcessing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (!v) {
        setTimeout(() => {
          setSuccess(false);
          setProcessing(false);
          setError(null);
        }, 200);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Mock Checkout
          </DialogTitle>
          <DialogDescription>
            This is a simulated payment. No real card is charged. The invoice
            will be marked as &ldquo;paid&rdquo; instantly.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border-2 border-emerald-500 bg-emerald-100 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]">
              <CheckCircle2 className="size-7 text-emerald-600" strokeWidth={2.5} />
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
              Payment Successful!
            </h3>
            <p className="text-xs font-medium text-slate-600">
              Receipt will appear in your invoice history shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mock card preview */}
            <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-slate-900 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center justify-between text-[#FDFBF7]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Mock Card
                </span>
                <CreditCard className="size-5 text-slate-400" />
              </div>
              <div className="mt-3 font-mono text-sm tracking-widest text-[#FDFBF7]">
                4242 4242 4242 4242
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>CampusOS Tester</span>
                <span>12/26</span>
              </div>
            </div>

            {/* Invoice summary */}
            <div className="rounded-xl border-2 border-slate-200 bg-[#FDFBF7] p-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">{invoice.title}</span>
                <span className="text-slate-900">{studentName ?? "—"}</span>
              </div>
              <div className="mt-2 flex items-end justify-between border-t-2 border-dashed border-slate-900 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Amount
                </span>
                <span className="font-mono text-2xl font-black tabular-nums text-slate-900">
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
              >
                {error}
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="emerald"
              onClick={handlePay}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <CreditCard className="size-4" />
                  Pay {formatCurrency(invoice.total_amount)}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
