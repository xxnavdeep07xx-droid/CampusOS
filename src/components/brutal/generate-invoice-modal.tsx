"use client";

import { useState } from "react";
import { Loader2, Plus, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClassRoom, Profile } from "@/lib/types";

/**
 * GenerateInvoiceModal — lets a principal/staff create invoices:
 *   - For a single student (by selecting one)
 *   - For an entire class (batch — one invoice per enrolled student)
 *
 * Fields: title, description, total_amount, due_date, target (class|student).
 *
 * On submit → POST /api/invoices. If target is a class, the API creates
 * N invoices (one per student). Calls onCreated() on success so the
 * parent can refresh.
 */
export function GenerateInvoiceModal({
  schoolId,
  classes,
  students,
  onCreated,
}: {
  schoolId: string;
  classes: Pick<ClassRoom, "id" | "name">[];
  students: Pick<Profile, "id" | "full_name" | "class_id">[];
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setTargetType("class");
    setClassId("");
    setStudentId("");
    setTitle("");
    setDescription("");
    setAmount("");
    setDueDate("");
    setCreating(false);
    setError(null);
    setSuccess(false);
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleCreate() {
    if (!title.trim() || !amount.trim()) {
      setError("Title and amount are required.");
      return;
    }
    if (targetType === "class" && !classId) {
      setError("Please select a class.");
      return;
    }
    if (targetType === "student" && !studentId) {
      setError("Please select a student.");
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Amount must be a non-negative number.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        schoolId,
        title: title.trim(),
        description: description.trim(),
        totalAmount: parsedAmount,
        dueDate: dueDate || null,
      };
      if (targetType === "class") {
        body.classId = classId;
      } else {
        body.studentId = studentId;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setSuccess(true);
      setTimeout(() => {
        onCreated?.();
        close();
      }, 1200);
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
        <Button variant="emerald">
          <Plus className="size-4" />
          Generate Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            Generate Invoice
          </DialogTitle>
          <DialogDescription>
            Create a fee invoice for a single student or batch for an entire class.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]">
            ✓ Invoice(s) created successfully!
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target type toggle */}
            <div className="space-y-2">
              <Label>Target</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType("class")}
                  className={`flex-1 rounded-xl border-2 border-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    targetType === "class"
                      ? "bg-emerald-500 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(5,150,105,1)]"
                      : "bg-white text-slate-700 hover:bg-amber-100"
                  }`}
                >
                  Entire Class
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("student")}
                  className={`flex-1 rounded-xl border-2 border-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    targetType === "student"
                      ? "bg-emerald-500 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(5,150,105,1)]"
                      : "bg-white text-slate-700 hover:bg-amber-100"
                  }`}
                >
                  Single Student
                </button>
              </div>
            </div>

            {targetType === "class" ? (
              <div className="space-y-2">
                <Label htmlFor="inv-class">Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger id="inv-class">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="inv-student">Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger id="inv-student">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || "(no name)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="inv-title">Title</Label>
              <Input
                id="inv-title"
                type="text"
                placeholder="e.g. Term 1 Tuition"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-desc">Description (optional)</Label>
              <Textarea
                id="inv-desc"
                rows={2}
                placeholder="What does this fee cover?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inv-amount">Amount ($)</Label>
                <Input
                  id="inv-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="250.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-due">Due date</Label>
                <Input
                  id="inv-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
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
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="emerald"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Receipt className="size-4" />
                  Create invoice
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
