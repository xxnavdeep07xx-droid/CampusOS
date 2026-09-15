"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StudentEntry = {
  id: string;
  full_name: string;
  class_id: string;
  class_name: string;
  joined_at: string;
};

/**
 * StudentDirectorySearch — client-side searchable directory of the teacher's
 * students. Groups by class, supports fuzzy search across student names +
 * class names, and links each row to the Student 360° profile page.
 */
export function StudentDirectorySearch({ students }: { students: StudentEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter((s) => {
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q)
      );
    });
  }, [students, query]);

  // Group filtered students by class.
  const grouped = useMemo(() => {
    const g: Record<string, StudentEntry[]> = {};
    for (const s of filtered) {
      const cid = s.class_id || "—";
      if (!g[cid]) g[cid] = [];
      g[cid].push(s);
    }
    return g;
  }, [filtered]);

  // Track class names separately so we can render the header even if a class
  // has no matching students (we still want to show empty-class state).
  const classNames: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of students) {
      m[s.class_id || "—"] = s.class_name;
    }
    return m;
  }, [students]);

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students by name or class…"
          className="h-11 w-full rounded-xl border-2 border-slate-900 bg-white px-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
        {query.trim() && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border-2 border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-bold text-slate-700">No students match your search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([clsId, items]) => (
            <Card key={clsId} className="overflow-hidden">
              <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-rose-300" />
              <div className="border-b-2 border-slate-200 bg-slate-50 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-black uppercase tracking-tight text-slate-900">
                      {classNames[clsId] ?? "—"}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {items.length} {items.length === 1 ? "student" : "students"}
                      {query.trim() && ` (filtered from ${students.filter((s) => s.class_id === clsId).length})`}
                    </div>
                  </div>
                  <Badge variant="emerald">{items.length} enrolled</Badge>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="divide-y-2 divide-slate-200">
                  {items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/dashboard/students/${s.id}`}
                      className="group flex items-center justify-between py-3 px-6 transition-all hover:bg-amber-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg border-2 border-slate-900 bg-amber-200 text-xs font-black uppercase text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                          {(s.full_name || "?").slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-slate-700">
                            {s.full_name}
                          </div>
                          <div className="text-xs font-medium text-slate-500">
                            Joined {new Date(s.joined_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          student
                        </Badge>
                        <ArrowRight className="size-4 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-slate-900" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
