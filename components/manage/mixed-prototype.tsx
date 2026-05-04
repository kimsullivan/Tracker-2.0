"use client"

import { useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { TopBar } from "@/components/manage/top-bar"
import { GrainBar, GrainNavToggle, type Grain } from "@/components/manage/grain-bar"
import { CommandCenterWorkspace, Greeting, PulseStrip } from "@/components/manage/command-center"
import { AllGrants } from "@/components/manage/all-grants"
import { GrantPage } from "@/components/manage/grant-page"
import { AgentRail } from "@/components/manage/agent-rail"
import { ChatPanelStandalone, getManageAssistantInitialMessages, getManageAssistantSuggestions } from "@/components/manage/chat-panel.standalone"
import { grants } from "@/lib/manage/data"
import { ManagePrototypeSidebar } from "@/components/sidebar/manage-prototype-sidebar"

/**
 * Wide primary column only (~120rem cap): KPI + toggle + table/queue.
 * Operator chat is never inside this — it’s a separate column beside it on All grants.
 */
const MIXED_PRIMARY =
  "mx-auto w-full max-w-[min(100%,120rem)] px-6 md:px-8 lg:px-10"

/**
 * Mixed prototype: primary shell = KPIs + All grants (or My work queue) only; embedded
 * operator chat sits outside that shell, beside the primary column.
 */
export function MixedPrototype() {
  const allGrantsScrollRef = useRef<HTMLDivElement>(null)
  const [grain, setGrain] = useState<Grain>("command")
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null)
  const [operatorChatOpen, setOperatorChatOpen] = useState(false)

  const grant = activeGrantId ? grants.find((g) => g.id === activeGrantId) : null

  function openGrant(id: string) {
    setActiveGrantId(id)
    setGrain("all-grants")
  }

  function closeGrant() {
    setActiveGrantId(null)
  }

  const contextLabel = grant
    ? grant.title
    : grain === "command"
      ? "My work"
      : "All grants table"

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-background">
      <ManagePrototypeSidebar
        grain={grain}
        onRequestGrain={(g) => {
          setGrain(g)
          setActiveGrantId(null)
        }}
        onClearGrant={() => setActiveGrantId(null)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <TopBar showNewGrant={!grant && grain === "all-grants"} />
        {grant ? (
          <GrainBar
            breadcrumb={{
              label: grant.title,
              onBack: closeGrant,
            }}
          />
        ) : null}

        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
          {grant ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <GrantPage grantId={grant.id} />
            </div>
          ) : (
            <>
              {/* Primary: greeting (My work) + KPIs + toggle + queue OR grants table only */}
              <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div
                  className={cn(
                    MIXED_PRIMARY,
                    "flex min-h-0 min-w-0 flex-1 flex-col pt-8 pb-6",
                  )}
                >
                  <div
                    className={cn(
                      "grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                      grain === "command" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-6 pb-6">
                        <Greeting />
                      </div>
                    </div>
                  </div>

                  {grain === "command" ? (
                    <>
                      <div className="shrink-0 space-y-6">
                        <PulseStrip />
                        <GrainNavToggle active={grain} onChange={setGrain} size="panel" />
                      </div>
                      <div className="relative mt-6 flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
                          <CommandCenterWorkspace onOpenGrant={openGrant} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div
                      ref={allGrantsScrollRef}
                      className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
                    >
                      <div className="shrink-0 space-y-6 pb-4">
                        <PulseStrip />
                      </div>
                      <AllGrants
                        onOpenGrant={openGrant}
                        variant="operator"
                        flatChrome
                        showToolbarNewGrant={false}
                        pageScrollMode
                        pageScrollContainerRef={allGrantsScrollRef}
                        stickyFilterPrefix={<GrainNavToggle active={grain} onChange={setGrain} size="panel" />}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Operator chat: outside primary shell; beside table, not under KPIs */}
              {grain === "all-grants" && operatorChatOpen ? (
                <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden px-0 pt-6 pb-6 max-md:bg-background md:max-w-[26rem] md:w-[min(26rem,32vw)] md:shrink-0 md:bg-transparent md:px-4 md:pt-8 md:pb-6 md:pr-6 xl:pr-8">
                  <div className="operator-chat-enter flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-[0_14px_44px_-10px_rgba(61,58,138,0.22)] dark:shadow-[0_18px_56px_-12px_rgba(61,58,138,0.42)]">
                    <ChatPanelStandalone
                      variant="manage"
                      layout="embedded"
                      className="h-full min-h-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none backdrop-blur-none dark:bg-transparent"
                      contextLabel={contextLabel}
                      onClose={() => setOperatorChatOpen(false)}
                      title="Grants assistant"
                      initialMessages={getManageAssistantInitialMessages()}
                      suggestions={getManageAssistantSuggestions()}
                    />
                  </div>
                </aside>
              ) : null}
            </>
          )}
        </main>

        {grain === "command" && !grant ? (
          <AgentRail contextLabel={contextLabel} />
        ) : null}
        {!grant && grain === "all-grants" && !operatorChatOpen ? (
          <button
            type="button"
            onClick={() => setOperatorChatOpen(true)}
            className="fixed right-4 bottom-4 z-50 group flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-lg ring-1 ring-border/40 transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--chart-1))",
            }}
            aria-label="Open grants assistant"
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={1.75} aria-hidden />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-chart-3 ring-2 ring-background" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
