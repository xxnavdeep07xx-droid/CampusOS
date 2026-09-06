"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SectionHeading — bold uppercase heading with the small accent bar above.
 * Used at the top of every marketing + auth section.
 */
interface SectionHeadingProps {
  children: ReactNode;
  className?: string;
  accent?: string; // tailwind bg-* class for the accent bar
}

export function SectionHeading({
  children,
  className,
  accent = "bg-emerald-500",
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("h-7 w-2 border-2 border-slate-900", accent)} aria-hidden />
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
        {children}
      </h2>
    </div>
  );
}

/**
 * Tag — a tiny pill chip used for labels. Default variant = outlined.
 */
export function Tag({
  children,
  className,
  color = "bg-amber-200",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-slate-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
        color,
        className
      )}
    >
      {children}
    </span>
  );
}
