"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * BrutalLogo — the CampusOS wordmark.
 *
 * A thick-bordered emerald square with the "C" + wordmark. Used in the sidebar,
 * landing hero, and auth pages.
 */
export function BrutalLogo({
  className,
  size = "md",
  asLink = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}) {
  const sizes = {
    sm: { box: "h-8 w-8", text: "text-lg", pad: "p-1.5" },
    md: { box: "h-10 w-10", text: "text-xl", pad: "p-2" },
    lg: { box: "h-14 w-14", text: "text-3xl", pad: "p-3" },
  } as const;
  const s = sizes[size];

  const inner = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border-2 border-slate-900 bg-emerald-500 font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]",
          s.box,
          s.pad,
          s.text
        )}
      >
        C
      </div>
      <span
        className={cn(
          "font-black uppercase tracking-tight text-slate-900",
          s.text
        )}
      >
        Campus<span className="text-emerald-600">OS</span>
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link href="/" className="inline-flex">
        {inner}
      </Link>
    );
  }
  return inner;
}

/**
 * BrutalCard — a higher-impact variant of the shadcn Card for marketing pages.
 * Supports an `accent` color on the top edge.
 */
export function BrutalAccent({
  color = "bg-emerald-500",
  className,
  children,
}: {
  color?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full rounded-t-xl border-x-2 border-t-2 border-slate-900",
        color,
        className
      )}
    >
      {children}
    </div>
  );
}
