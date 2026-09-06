import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Neo-brutalist Button override.
 *
 * Design contract:
 *   - thick black border (`border-2 border-slate-900`)
 *   - hard offset shadow with zero blur
 *   - on hover, the element translates up-left and the shadow grows
 *   - on active, the element translates down-right and the shadow shrinks
 *
 * Variants:
 *   - default  → ink background, cream foreground (primary action)
 *   - emerald  → vibrant pop-art emerald (success / create)
 *   - sky      → vibrant sky blue (info / share)
 *   - coral    → vibrant coral (danger-ish / destructive)
 *   - amber    → vibrant amber (warning / highlight)
 *   - outline  → transparent background, ink border
 *   - ghost    → no border, subtle hover bg
 */
const buttonVariants = cva(
  // base classes
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold uppercase tracking-wide " +
  "border-2 border-slate-900 transition-all duration-120 ease-out " +
  "shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] " +
  "hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] " +
  "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 " +
  "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 " +
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:  "bg-slate-900 text-[#FDFBF7]",
        emerald:  "bg-emerald-500 text-slate-900",
        sky:      "bg-sky-300 text-slate-900",
        coral:    "bg-rose-400 text-slate-900",
        amber:    "bg-amber-400 text-slate-900",
        violet:   "bg-violet-500 text-[#FDFBF7]",
        lemon:    "bg-yellow-300 text-slate-900",
        outline:  "bg-[#FDFBF7] text-slate-900",
        secondary:"bg-amber-200 text-slate-900",
        ghost:
          "bg-transparent border-transparent shadow-none text-slate-900 hover:bg-slate-900/5 hover:shadow-none hover:translate-x-0 hover:translate-y-0",
        destructive: "bg-rose-500 text-[#FDFBF7]",
        link:
          "bg-transparent border-transparent shadow-none text-slate-900 underline-offset-4 hover:underline hover:shadow-none hover:translate-x-0 hover:translate-y-0",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-4",
        sm:     "h-9 rounded-lg px-3 text-xs has-[>svg]:px-2.5",
        lg:     "h-12 rounded-xl px-7 text-base has-[>svg]:px-5",
        xl:     "h-14 rounded-2xl px-8 text-lg has-[>svg]:px-6",
        icon:   "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
