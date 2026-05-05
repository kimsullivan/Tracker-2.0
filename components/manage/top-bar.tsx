"use client"

import { Suspense } from "react"
import { Bell, Plus, Search, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PrototypeSwitcher } from "@/components/manage/prototype-switcher"

export function TopBar({
  showNewGrant = false,
  showBottomStroke = true,
}: {
  showNewGrant?: boolean
  /** When false, hides the divider under the app header row. */
  showBottomStroke?: boolean
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-4 bg-white px-4",
        showBottomStroke ? "border-b border-border" : "border-b-0",
      )}
    >
      <span className="font-heading shrink-0 font-bold text-foreground">Tracker</span>

      <div className="relative hidden min-w-0 flex-1 md:block">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search grants, funders, notes…"
          className="h-8 w-full max-w-md rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showNewGrant ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 rounded-md px-2.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New grant
          </Button>
        ) : null}
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(100vw-2rem,17rem)]">
            <DropdownMenuLabel>Prototype</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 pb-2 pt-0.5">
              <Suspense
                fallback={<div className="h-16 w-full animate-pulse rounded-md bg-muted/50" aria-hidden />}
              >
                <PrototypeSwitcher layout="vertical" />
              </Suspense>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
