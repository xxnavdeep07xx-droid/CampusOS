"use client";

import { useState } from "react";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import type { BehaviorIncident, IncidentCategory, IncidentSeverity } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * StudentBehaviorLog
 *
 * Lists all behavior incidents for a student with the ability to log new
 * ones (modal) and delete existing ones. Edit is intentionally omitted in
 * this iteration — incidents are time-stamped events, and teachers usually
 * want to delete + re-log rather than rewrite history.
 */
export function StudentBehaviorLog({
  studentId,
  className,
  classId,
  initialIncidents,
  canEdit,
}: {
  studentId: string;
  className: string;
  classId: string | null;
  initialIncidents: BehaviorIncident[];
  canEdit: boolean;
}) {
  const [incidents, setIncidents] = useState<BehaviorIncident[]>(initialIncidents);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this incident? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
            <Megaphone className="size-4" /> Behavior log
          </CardTitle>
          {canEdit && (
            <LogIncidentModal
              studentId={studentId}
              className={className}
              classId={classId}
              onCreated={(newIncident) => setIncidents((prev) => [newIncident, ...prev])}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-slate-500">
            No incidents logged yet. {canEdit && "Use the button above to log one."}
          </p>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <IncidentRow
                key={inc.id}
                incident={inc}
                canDelete={canEdit}
                deleting={deletingId === inc.id}
                onDelete={() => handleDelete(inc.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IncidentRow({
  incident,
  canDelete,
  deleting,
  onDelete,
}: {
  incident: BehaviorIncident;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const severityMeta = SEVERITY_META[incident.severity];
  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-[#FDFBF7]">
      <div className={cn("flex h-1.5 w-full border-x-2 border-t-2 border-slate-900", severityMeta.barClass)} />
      <div className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className={cn("border-slate-900", severityMeta.badgeClass)}>
              {severityMeta.emoji} {severityMeta.label}
            </Badge>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {incident.category}
            </span>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-lg border-2 border-slate-900 bg-rose-100 p-1.5 transition-all hover:bg-rose-400 hover:text-[#FDFBF7] disabled:opacity-50"
              aria-label="Delete incident"
              title="Delete incident"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </button>
          )}
        </div>
        <div className="mt-2 text-sm font-bold text-slate-900">{incident.title}</div>
        {incident.description && (
          <p className="mt-1 text-xs font-medium text-slate-700">{incident.description}</p>
        )}
        {incident.action_taken && (
          <div className="mt-2 rounded-lg border-2 border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
            <span className="font-bold uppercase tracking-wider">Action:</span> {incident.action_taken}
          </div>
        )}
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {formatDate(incident.incident_date)}
        </div>
      </div>
    </div>
  );
}

const SEVERITY_META: Record<IncidentSeverity, { label: string; emoji: string; badgeClass: string; barClass: string }> = {
  positive: {
    label: "Positive",
    emoji: "✓",
    badgeClass: "bg-emerald-500 text-[#FDFBF7]",
    barClass: "bg-emerald-500",
  },
  concern: {
    label: "Concern",
    emoji: "!",
    badgeClass: "bg-rose-500 text-[#FDFBF7]",
    barClass: "bg-rose-400",
  },
  neutral: {
    label: "Note",
    emoji: "•",
    badgeClass: "bg-slate-200 text-slate-900",
    barClass: "bg-slate-300",
  },
};

/**
 * LogIncidentModal — quick form to log a new incident.
 */
function LogIncidentModal({
  studentId,
  className,
  classId,
  onCreated,
}: {
  studentId: string;
  className: string;
  classId: string | null;
  onCreated: (incident: BehaviorIncident) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("neutral");
  const [category, setCategory] = useState<IncidentCategory>("behavioral");
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setActionTaken("");
    setSeverity("neutral");
    setCategory("behavioral");
    setIncidentDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId,
          incidentDate,
          severity,
          category,
          title: title.trim(),
          description: description.trim() || undefined,
          actionTaken: actionTaken.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      onCreated(json.incident as BehaviorIncident);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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
        <Button variant="coral" size="sm">
          <Plus className="size-4" />
          Log incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log behavior incident</DialogTitle>
          <DialogDescription>
            Record a disciplinary issue, positive milestone, or informational
            note. Visible to {className} teachers and school admins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inc-title">Title</Label>
            <Input
              id="inc-title"
              type="text"
              placeholder="e.g. Disrupted class 3 times today"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inc-severity">Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                <SelectTrigger id="inc-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">✓ Positive</SelectItem>
                  <SelectItem value="concern">! Concern</SelectItem>
                  <SelectItem value="neutral">• Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IncidentCategory)}>
                <SelectTrigger id="inc-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="recognition">Recognition</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inc-date">Incident date</Label>
            <Input
              id="inc-date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inc-desc">Description (optional)</Label>
            <Textarea
              id="inc-desc"
              rows={3}
              placeholder="What happened? Give context for future reference."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inc-action">Action taken (optional)</Label>
            <Input
              id="inc-action"
              type="text"
              placeholder="e.g. Spoke with student after class"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
            >
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="coral"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Log incident
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
