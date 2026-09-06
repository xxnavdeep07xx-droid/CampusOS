"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

/**
 * Neo-brutalist Progress override.
 *
 * - thick black border + hard offset shadow
 * - chunky height (h-3 by default, configurable via className)
 * - indicator uses emerald by default but can be overridden via className
 *   (e.g. bg-amber-400 for "due soon", bg-rose-500 for "low")
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full border-2 border-slate-900 bg-[#FDFBF7] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full flex-1 bg-emerald-500 transition-all duration-300"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
