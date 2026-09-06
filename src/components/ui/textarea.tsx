import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-slate-400 flex field-sizing-content min-h-20 w-full rounded-xl border-2 border-slate-900 bg-white px-4 py-3 text-base font-medium " +
        "shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all outline-none " +
        "focus-visible:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] focus-visible:translate-x-[-2px] focus-visible:translate-y-[-2px] " +
        "aria-invalid:border-rose-500 aria-invalid:shadow-[2px_2px_0px_0px_rgba(244,63,94,1)] " +
        "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
