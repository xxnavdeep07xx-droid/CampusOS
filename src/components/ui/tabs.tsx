"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Neo-brutalist Tabs override.
 *
 * - List: white card with thick black border + hard shadow.
 * - Trigger: pill button that pops (border + bg + shadow) when active.
 * - Trigger inactive: transparent, just bold uppercase text.
 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-white p-1.5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-transparent px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 transition-all",
        "hover:border-slate-900 hover:bg-amber-100 hover:text-slate-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-[#FDFBF7] data-[state=active]:shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:zoom-in-95 data-[state=active]:duration-200",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
