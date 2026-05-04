"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { ChatPanelStandalone } from "./chat-panel.standalone"

export function AgentRail({ contextLabel }: { contextLabel: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-50 group flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-lg ring-1 ring-border/40 transition-all hover:scale-105"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--chart-1))",
        }}
        aria-label="Open assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-chart-3 ring-2 ring-background" />
      </button>
    )
  }

  return <ChatPanelStandalone contextLabel={contextLabel} onClose={() => setOpen(false)} />
}
