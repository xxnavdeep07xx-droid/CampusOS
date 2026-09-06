import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Neo-brutalist Input override.
 * - white background
 * - thick black border
 * - hard offset shadow on focus
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-slate-400 selection:bg-slate-900 selection:text-[#FDFBF7] " +
        "flex h-11 w-full min-w-0 rounded-xl border-2 border-slate-900 bg-white px-4 py-2 text-base font-medium " +
        "shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all outline-none " +
        "focus-visible:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] focus-visible:translate-x-[-2px] focus-visible:translate-y-[-2px] " +
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 " +
        "aria-invalid:border-rose-500 aria-invalid:shadow-[2px_2px_0px_0px_rgba(244,63,94,1)] " +
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
