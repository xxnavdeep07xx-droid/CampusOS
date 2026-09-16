"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { roleColor } from "@/lib/types";

type StaffEntry = {
  id: string;
  full_name: string;
  role: string;
  school_id: string;
  created_at: string;
  class_count: number | null;
};

type ParentEntry = {
  id: string;
  full_name: string;
  students: { id: string; full_name: string; class_id: string; class_name: string }[];
};

/**
 * StaffDirectoryClient
 *
 * Searchable directory of:
 *   - School staff (teachers, principals, staff)
 *   - Parents of the caller's students (teachers only)
 *
 * Each row has a "Message" button that deep-links to /dashboard/teacher/messages?peer=USER_ID
 */
export function StaffDirectoryClient({
  staff,
  parents,
  currentUserId,
}: {
  staff: StaffEntry[];
  parents: ParentEntry[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"staff" | "parents">("staff");

  const filteredStaff = staff.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });

  const filteredParents = parents.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.students.some((s) => s.full_name.toLowerCase().includes(q) || s.class_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-1">
          <TabButton active={tab === "staff"} onClick={() => setTab("staff")} count={staff.length}>
            Staff
          </TabButton>
          <TabButton active={tab === "parents"} onClick={() => setTab("parents")} count={parents.length}>
            Parents
          </TabButton>
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "staff" ? "Search by name or role…" : "Search by parent or student name…"}
            className="h-10 w-full rounded-lg border-2 border-slate-200 bg-[#FDFBF7] pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {tab === "staff" ? (
        <StaffList entries={filteredStaff} currentUserId={currentUserId} />
      ) : parents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto mb-3 size-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-900">No parents linked yet</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              When parents register and link to their children (students in your
              classes), they&apos;ll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ParentsList entries={filteredParents} currentUserId={currentUserId} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
        active
          ? "bg-slate-900 text-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
          : "bg-white text-slate-700 hover:bg-amber-50"
      )}
    >
      {children}
      <span
        className={cn(
          "ml-1 rounded-full px-1.5 text-[10px]",
          active ? "bg-[#FDFBF7]/20" : "bg-slate-100"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StaffList({ entries, currentUserId }: { entries: StaffEntry[]; currentUserId: string }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Users className="mx-auto mb-3 size-10 text-slate-400" />
          <p className="text-sm font-bold text-slate-700">No staff match your search.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="divide-y-2 divide-slate-200 p-0">
        {entries.map((s) => {
          const isMe = s.id === currentUserId;
          return (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                  {(s.full_name || "?").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">
                    {s.full_name || "(no name)"}
                    {isMe && <span className="ml-2 text-xs font-medium text-slate-500">(you)</span>}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Joined {new Date(s.created_at).toLocaleDateString()}
                    {s.class_count != null && s.class_count > 0 && (
                      <> · {s.class_count} class{s.class_count === 1 ? "" : "es"}</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("capitalize", roleColor(s.role as any))}>
                  {s.role}
                </Badge>
                {!isMe && (
                  <Link
                    href={`/dashboard/teacher/messages?peer=${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-sky-300 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]"
                  >
                    <MessageCircle className="size-3.5" strokeWidth={2.5} />
                    Message
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ParentsList({ entries, currentUserId }: { entries: ParentEntry[]; currentUserId: string }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-bold text-slate-700">No parents match your search.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="divide-y-2 divide-slate-200 p-0">
        {entries.map((p) => (
          <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-emerald-300 text-xs font-black uppercase text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                {(p.full_name || "?").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold text-slate-900">{p.full_name || "(no name)"}</div>
                <div className="mt-1 space-y-0.5">
                  {p.students.map((s) => (
                    <div key={s.id} className="text-xs font-medium text-slate-600">
                      <span className="font-bold text-slate-900">{s.full_name}</span>
                      <span className="ml-1 text-slate-500">· {s.class_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Link
              href={`/dashboard/teacher/messages?peer=${p.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-sky-300 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]"
            >
              <MessageCircle className="size-3.5" strokeWidth={2.5} />
              Message
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
