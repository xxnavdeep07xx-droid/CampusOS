"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlobalNotice } from "@/lib/types";
import { formatDate } from "@/lib/storage";

/**
 * GlobalNoticeBanner — renders active school-wide notices as a dismissible
 * marquee/alert bar at the very top of the dashboard layout.
 *
 * Each notice can be individually dismissed (tracked in localStorage by
 * notice ID — so dismissed notices don't reappear on next page load).
 * The bar auto-hides when all notices are dismissed.
 *
 * Visual: bg-amber-400 + border-2 border-slate-900 + hard shadow +
 * Megaphone icon. Marquee-style scroll on the content text for long
 * notices.
 */
export function GlobalNoticeBanner({
  notices,
}: {
  notices: GlobalNotice[];
}) {
  // Load dismissed IDs from localStorage on mount (lazy initial state
  // avoids the set-state-in-effect lint error).
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("campusos:dismissedNotices");
      if (stored) return new Set(JSON.parse(stored));
    } catch {
      // localStorage not available — fine, just show all.
    }
    return new Set();
  });
  const [currentIdx, setCurrentIdx] = useState(0);

  // Filter out dismissed notices.
  const visible = notices.filter((n) => !dismissed.has(n.id));

  // Clamp currentIdx so it never points past the end of `visible`.
  // (Replaces the old useEffect that reset to 0 on `dismissed` change —
  // avoids the react-hooks/set-state-in-effect lint error.)
  const safeIdx = visible.length === 0 ? 0 : Math.min(currentIdx, visible.length - 1);

  // Cycle through visible notices every 6 seconds.
  useEffect(() => {
    if (visible.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % visible.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [visible.length]);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(
          "campusos:dismissedNotices",
          JSON.stringify([...next])
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  if (visible.length === 0) return null;

  const current = visible[safeIdx] ?? visible[0];

  return (
    <div
      role="alert"
      className="relative z-40 border-b-2 border-slate-900 bg-amber-400 shadow-[0_3px_0px_0px_rgba(15,23,42,1)]"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-slate-900">
          <Megaphone className="size-3.5 text-[#FDFBF7]" strokeWidth={2.5} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-xs font-black uppercase tracking-wider text-slate-900">
              {current.title}
            </span>
            {visible.length > 1 && (
              <span className="text-[10px] font-bold text-slate-700">
                ({safeIdx + 1}/{visible.length})
              </span>
            )}
          </div>
          <p className="truncate text-xs font-medium text-slate-800">
            {current.content}
          </p>
        </div>

        <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-700 sm:block">
          {formatDate(current.publish_date)}
        </span>

        <button
          type="button"
          onClick={() => dismiss(current.id)}
          className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-slate-900 bg-white transition-all hover:bg-slate-900 hover:text-[#FDFBF7]"
          aria-label="Dismiss notice"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Progress dots for multiple notices */}
      {visible.length > 1 && (
        <div className="flex justify-center gap-1 pb-1.5">
          {visible.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setCurrentIdx(i)}
              className={cn(
                "h-1.5 rounded-full border border-slate-900 transition-all",
                i === safeIdx ? "w-6 bg-slate-900" : "w-1.5 bg-white hover:bg-slate-300"
              )}
              aria-label={`Go to notice ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
