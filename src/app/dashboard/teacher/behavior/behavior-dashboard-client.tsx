"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Megaphone,
  Search,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BehaviorIncident } from "@/lib/types";
import { formatDate } from "@/lib/storage";

type IncidentWithJoins = BehaviorIncident & {
  student?: { id: string; full_name: string } | null;
  recorder?: { id: string; full_name: string } | null;
  classes?: { id: string; name: string } | null;
};

const SEVERITY_META: Record<string, { label: string; emoji: string; badgeClass: string; barClass: string; statColor: string }> = {
  positive: {
    label: "Positive",
    emoji: "✓",
    badgeClass: "bg-emerald-500 text-[#FDFBF7]",
    barClass: "bg-emerald-500",
    statColor: "bg-emerald-400",
  },
  concern: {
    label: "Concern",
    emoji: "!",
    badgeClass: "bg-rose-500 text-[#FDFBF7]",
    barClass: "bg-rose-400",
    statColor: "bg-rose-400",
  },
  neutral: {
    label: "Note",
    emoji: "•",
    badgeClass: "bg-slate-200 text-slate-900",
    barClass: "bg-slate-300",
    statColor: "bg-slate-300",
  },
};

/**
 * BehaviorDashboardClient
 *
 * Renders the class-wide behavior dashboard with:
 *   - 4 stat cards (Total / Positive / Concern / Neutral)
 *   - Filter by class + severity + search by student name
 *   - Sortable incident list
 */
export function BehaviorDashboardClient({
  initialIncidents,
  classes,
  migrationMissing,
}: {
  initialIncidents: IncidentWithJoins[];
  classes: { id: string; name: string }[];
  migrationMissing: boolean;
}) {
  const [incidents, setIncidents] = useState<IncidentWithJoins[]>(initialIncidents);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  if (migrationMissing) {
    return (
      <Card className="overflow-hidden border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
        <div className="h-2 w-full border-x-2 border-t-2 border-amber-500 bg-amber-400" />
        <CardContent className="space-y-2 py-5">
          <h3 className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-amber-700">
            <AlertTriangle className="size-4" /> Phase 9 migration needed
          </h3>
          <p className="text-sm font-medium text-slate-700">
            The <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">behavior_incidents</code> table
            doesn&apos;t exist yet.
          </p>
          <p className="text-xs font-medium text-slate-600">
            Apply <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/migrations/0009_behavior_incidents.sql</code>
            {" "}via the Supabase SQL editor.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stats — computed from all incidents (before filtering).
  const stats = useMemo(() => {
    const total = incidents.length;
    const positive = incidents.filter((i) => i.severity === "positive").length;
    const concern = incidents.filter((i) => i.severity === "concern").length;
    const neutral = incidents.filter((i) => i.severity === "neutral").length;
    return { total, positive, concern, neutral };
  }, [incidents]);

  // Apply filters.
  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (classFilter !== "all" && i.class_id !== classFilter) return false;
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const studentName = i.student?.full_name?.toLowerCase() ?? "";
        const title = i.title.toLowerCase();
        if (!studentName.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, classFilter, severityFilter, search]);

  // Group by date for the list view.
  const grouped = useMemo(() => {
    const g: Record<string, IncidentWithJoins[]> = {};
    for (const i of filtered) {
      const key = i.incident_date;
      if (!g[key]) g[key] = [];
      g[key].push(i);
    }
    return Object.entries(g).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Megaphone className="size-4" />}
          label="Total incidents"
          value={stats.total}
          sublabel="Across all classes"
          color="bg-violet-400"
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Positive"
          value={stats.positive}
          sublabel="Milestones + recognition"
          color="bg-emerald-400"
        />
        <StatCard
          icon={<AlertCircle className="size-4" />}
          label="Concerns"
          value={stats.concern}
          sublabel="Disciplinary issues"
          color="bg-rose-400"
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Notes"
          value={stats.neutral}
          sublabel="Informational"
          color="bg-slate-300"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student or title…"
            className="h-10 w-full rounded-lg border-2 border-slate-200 bg-[#FDFBF7] pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            aria-label="Search incidents"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-slate-500" />
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-10 w-40" aria-label="Filter by class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-10 w-36" aria-label="Filter by severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="positive">✓ Positive</SelectItem>
              <SelectItem value="concern">! Concern</SelectItem>
              <SelectItem value="neutral">• Note</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border-2 border-slate-900 bg-amber-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-900">
          {filtered.length} shown
        </div>
      </div>

      {/* Incident list — grouped by date */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Megaphone className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">
              {incidents.length === 0 ? "No incidents logged yet" : "No incidents match your filters"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {incidents.length === 0
                ? "Open any student's profile to log a behavior incident."
                : "Try adjusting your search or filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dayIncidents]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {formatDate(date)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  · {dayIncidents.length} {dayIncidents.length === 1 ? "incident" : "incidents"}
                </span>
              </div>
              <div className="space-y-2">
                {dayIncidents.map((inc) => (
                  <IncidentRow key={inc.id} incident={inc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
      <div className={cn("flex h-1.5 items-center justify-center border-x-2 border-t-2 border-slate-900", color)} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-xl font-black text-slate-900">{value}</div>
        <div className="text-[10px] font-medium text-slate-500">{sublabel}</div>
      </div>
    </div>
  );
}

function IncidentRow({ incident }: { incident: IncidentWithJoins }) {
  const meta = SEVERITY_META[incident.severity] ?? SEVERITY_META.neutral;
  const studentName = incident.student?.full_name ?? "Unknown";
  const className = incident.classes?.name ?? "—";
  const recorderName = incident.recorder?.full_name ?? "Unknown";

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1.5 w-full border-x-2 border-t-2 border-slate-900", meta.barClass)} />
      <CardContent className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-slate-900", meta.badgeClass)}>
                {meta.emoji} {meta.label}
              </Badge>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {incident.category}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                · {className}
              </span>
            </div>
            <div className="mt-1.5 text-sm font-bold text-slate-900">{incident.title}</div>
            {incident.description && (
              <p className="mt-1 text-xs font-medium text-slate-700">{incident.description}</p>
            )}
            {incident.action_taken && (
              <div className="mt-2 rounded-lg border-2 border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                <span className="font-bold uppercase tracking-wider">Action:</span> {incident.action_taken}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>by {recorderName}</span>
            </div>
          </div>
          <Link
            href={`/dashboard/students/${incident.student_id}`}
            className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-slate-900 bg-amber-200 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            title={`View ${studentName}'s profile`}
          >
            <div className="flex size-6 items-center justify-center rounded border-2 border-slate-900 bg-white text-[10px] font-black uppercase">
              {(studentName || "?").slice(0, 2)}
            </div>
            {studentName}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
