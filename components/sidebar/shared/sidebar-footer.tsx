import { Check, CircleHelp, Gift, Settings } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCOUNT_DISPLAY_NAMES, AccountId } from "@/hooks/use-account-state"
import { SidebarState } from "../use-sidebar"

interface SidebarFooterProps {
  sidebarState: SidebarState
}

export function SidebarFooter({ sidebarState }: SidebarFooterProps) {
  const { collapsed, currentAccount, onAccountChange } = sidebarState

  if (collapsed) {
    return (
      <div className="mt-auto px-3 pb-4">
        <div className="flex flex-col items-center gap-2">
          <CollapsedFooterIcon icon={Gift} tooltip="Give a free month" />
          <CollapsedFooterIcon icon={CircleHelp} tooltip="Help" />
          <AccountDropdown
            collapsed={collapsed}
            currentAccount={currentAccount}
            onAccountChange={onAccountChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-auto px-4 pb-4">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="group relative flex h-8 w-full items-center border-none pl-2 text-left font-sans text-[14px] font-light leading-[142%] text-[#333] transition-colors not-italic [font-feature-settings:'liga'_off,'clig'_off]"
        >
          <span
            className="pointer-events-none absolute inset-y-0 -left-1 -right-1 rounded-md bg-transparent transition-colors group-hover:bg-muted/50"
            aria-hidden="true"
          />
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
            <Gift className="h-4 w-4 shrink-0 text-[#333]" strokeWidth={1.5} aria-hidden />
            <span>Give a free month</span>
          </div>
        </button>

        <button
          type="button"
          className="group relative flex h-8 w-full items-center border-none pl-2 text-left font-sans text-[14px] font-light leading-[142%] text-[#333] transition-colors not-italic [font-feature-settings:'liga'_off,'clig'_off]"
        >
          <span
            className="pointer-events-none absolute inset-y-0 -left-1 -right-1 rounded-md bg-transparent transition-colors group-hover:bg-muted/50"
            aria-hidden="true"
          />
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
            <CircleHelp className="h-4 w-4 shrink-0 text-[#333]" strokeWidth={1.5} aria-hidden />
            <span>Help</span>
          </div>
        </button>

        <AccountDropdown
          collapsed={collapsed}
          currentAccount={currentAccount}
          onAccountChange={onAccountChange}
        />
      </div>
    </div>
  )
}

function CollapsedFooterIcon({
  icon: Icon,
  tooltip,
  onClick,
}: {
  icon: LucideIcon
  tooltip: string
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#333] transition-colors hover:bg-muted/50"
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function AccountDropdown({
  collapsed,
  currentAccount,
  onAccountChange,
}: {
  collapsed: boolean
  currentAccount: AccountId
  onAccountChange?: (account: AccountId) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#333] transition-colors hover:bg-muted/50"
              >
                <Settings className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} align="center">
              <p>Account</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            className="group relative flex h-8 w-full items-center border-none pl-2 text-left font-sans text-[14px] font-light leading-[142%] text-[#333] transition-colors not-italic [font-feature-settings:'liga'_off,'clig'_off]"
          >
            <span
              className="pointer-events-none absolute inset-y-0 -left-1 -right-1 rounded-md bg-transparent transition-colors group-hover:bg-muted/50"
              aria-hidden="true"
            />
            <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
              <Settings className="h-4 w-4 shrink-0 text-[#333]" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 flex-1 text-left">Account</span>
            </div>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-80 border border-smoke-100 shadow-elevation-medium">
        <DropdownMenuLabel className="px-2 py-1.5">Switch Account</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {(["super-admin", "hope", "kim", "nick", "deo"] as AccountId[]).map((accountId) => (
            <DropdownMenuItem
              key={accountId}
              onClick={() => onAccountChange?.(accountId)}
              className={cn(
                "flex cursor-pointer items-center justify-between px-2 py-2 font-light text-[#333]",
                "data-[highlighted]:bg-muted/50",
                currentAccount === accountId && "bg-secondary text-secondary-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <div>
                  <div>{ACCOUNT_DISPLAY_NAMES[accountId]}</div>
                  {accountId === "super-admin" && (
                    <div className="text-xs font-light text-smoke-300">Changes cascade to all accounts</div>
                  )}
                </div>
              </div>
              {currentAccount === accountId && <Check className="h-4 w-4" strokeWidth={1.5} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
