"use client"

import { Sparkle, type LucideProps } from "lucide-react"
import { cn } from "@/lib/utils"

/** Lucide `Sparkle` rendered solid (filled), no stroke outline. */
export function FilledSparkle({ className, ...props }: LucideProps) {
  return (
    <Sparkle
      className={cn(className)}
      {...props}
      fill="currentColor"
      stroke="none"
      strokeWidth={0}
    />
  )
}
