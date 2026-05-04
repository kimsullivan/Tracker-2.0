"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const MODES = [
  { param: null as string | null, label: "Static command center" },
  { param: "operator" as const, label: "Operator chat" },
]

export function PrototypeSwitcher({
  className,
  layout = "horizontal",
}: {
  className?: string
  layout?: "horizontal" | "vertical"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active =
    searchParams.get("prototype") === "operator" ? "operator" : "static"

  function setMode(next: "static" | "operator") {
    const p = new URLSearchParams(searchParams.toString())
    if (next === "static") {
      p.delete("prototype")
    } else {
      p.set("prototype", "operator")
    }
    const q = p.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  return (
    <div
      className={cn(
        layout === "vertical"
          ? "flex w-full flex-col gap-1 text-[11px]"
          : "flex max-w-full shrink-0 rounded-lg border border-border/60 bg-muted/40 p-0.5 text-[11px] shadow-sm",
        className,
      )}
      role="tablist"
      aria-label="Prototype mode"
    >
      {MODES.map((m) => {
        const isOperator = m.param === "operator"
        const selected = isOperator ? active === "operator" : active === "static"
        return (
          <button
            key={m.label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setMode(isOperator ? "operator" : "static")}
            className={cn(
              layout === "vertical"
                ? "w-full rounded-md border border-transparent px-2.5 py-2 text-left text-[11px] font-medium transition-colors"
                : "whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors",
              selected
                ? "border-border/60 bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:border-border/40 hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
