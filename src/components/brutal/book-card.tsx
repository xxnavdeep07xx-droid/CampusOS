"use client";

import Image from "next/image";
import { Book as BookIcon, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Book } from "@/lib/types";

/**
 * BookCard — a physical book look: tall rectangle (aspect ratio ~2:3),
 * heavy border-[3px] border-slate-900, book cover image fills the top 60%
 * (or a fallback colored block with the title), bottom 40% shows author +
 * Available/Out of Stock badge. Vibrant badge: bg-emerald-500 for
 * Available, bg-rose-500 for Out of Stock.
 */
export function BookCard({
  book,
  onClick,
  className,
}: {
  book: Book;
  onClick?: () => void;
  className?: string;
}) {
  const isAvailable = book.available_copies > 0;
  const coverColors = [
    "bg-emerald-400",
    "bg-sky-300",
    "bg-rose-300",
    "bg-amber-300",
    "bg-violet-400",
    "bg-teal-300",
  ];
  const colorIdx = book.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % coverColors.length;
  const coverBg = coverColors[colorIdx];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border-[3px] border-slate-900 bg-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all",
        "hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Cover — fills top 60% */}
      <div className="relative aspect-[3/2] overflow-hidden border-b-[3px] border-slate-900">
        {book.cover_image_url ? (
          <Image
            src={book.cover_image_url}
            alt={`Cover of ${book.title}`}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 16vw"
            className="object-cover"
            loading="lazy"
          />
        ) : (
          <div className={cn("flex h-full w-full flex-col items-center justify-center p-2 text-center", coverBg)}>
            <BookIcon className="size-8 text-slate-900/50" strokeWidth={2} />
            <span className="mt-1 line-clamp-2 text-xs font-black uppercase leading-tight text-slate-900/80">
              {book.title}
            </span>
          </div>
        )}
        {/* Availability badge */}
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border-2 border-slate-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]",
              isAvailable ? "bg-emerald-500 text-[#FDFBF7]" : "bg-rose-500 text-[#FDFBF7]"
            )}
          >
            {isAvailable ? "Available" : "Out of Stock"}
          </span>
        </div>
      </div>

      {/* Info — bottom 40% */}
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 text-xs font-black uppercase leading-tight tracking-tight text-slate-900">
          {book.title}
        </h3>
        {book.author && (
          <p className="truncate text-[10px] font-bold text-slate-600">
            by {book.author}
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          {book.isbn && (
            <span className="font-mono text-[9px] text-slate-400">
              {book.isbn}
            </span>
          )}
          <span className={cn(
            "ml-auto text-[9px] font-bold uppercase tracking-wider",
            isAvailable ? "text-emerald-700" : "text-rose-700"
          )}>
            {book.available_copies}/{book.total_copies} copies
          </span>
        </div>
      </div>
    </div>
  );
}
