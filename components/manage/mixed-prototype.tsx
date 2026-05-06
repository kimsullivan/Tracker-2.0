"use client"

import { useCallback, useLayoutEffect, useMemo, useState } from "react"
import { FilledSparkle } from "@/components/ui/filled-sparkle"
import { cn } from "@/lib/utils"
import { TopBar } from "@/components/manage/top-bar"
import { GrainBar, GrainNavToggle, type Grain } from "@/components/manage/grain-bar"
import { CommandCenterWorkspace, Greeting, MyWorkAttentionStrip, PulseStrip, MyWorkQueueToolbar, useMyWorkQueueState } from "@/components/manage/command-center"
import { AllGrants } from "@/components/manage/all-grants"
import { PulseStripRechartsStatic } from "@/components/manage/all-grants-kpi-tiles"
import { GrantPage } from "@/components/manage/grant-page"
import { ChatPanelStandalone, getElizabethAssistantInitialMessages, getManageAssistantSuggestions } from "@/components/manage/chat-panel.standalone"
import type { ChatTaskAction } from "@/components/manage/chat-inline-viz"
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
  const [grantsScrollEl, setGrantsScrollEl] = useState<HTMLDivElement | null>(null)
  const setGrantsScrollPort = useCallback((node: HTMLDivElement | null) => {
    setGrantsScrollEl(node)
  }, [])
  const [grain, setGrain] = useState<Grain>("command")
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null)
  const [operatorChatOpen, setOperatorChatOpen] = useState(false)

  const grant = activeGrantId ? grants.find((g) => g.id === activeGrantId) : null

  function openGrant(id: string) {
    setActiveGrantId(id)
  }

  function closeGrant() {
    setActiveGrantId(null)
  }

  const contextLabel = grant ? grant.title : grain === "command" ? "My work" : "All grants table"

  const workQueue = useMyWorkQueueState()

  const elizabethAssistantInitialMessages = useMemo(() => getElizabethAssistantInitialMessages(), [])

  const handleMixAltChatAction = useCallback(
    (action: ChatTaskAction): boolean => {
      const href = action.href
      if (!href.startsWith("mixalt://")) return false
      const rest = href.slice("mixalt://".length)
      if (rest.startsWith("grant/")) {
        const grantId = decodeURIComponent(rest.slice("grant/".length))
        openGrant(grantId)
        return true
      }
      return false
    },
    [openGrant],
  )

  const myWorkAttentionSummary = useMemo(() => {
    const openIssues = workQueue.items.filter((i) => !i.done).length
    const activeGrantCount = grants.filter((g) => g.stage !== "Closed" && g.stage !== "Declined").length
    return `${openIssues} issues need your attention · across ${activeGrantCount} active grants`
  }, [workQueue.items])

  /** `overflow:hidden` / `overflow-x:hidden` on ancestors disables `sticky` vs this column’s `overflow-y-auto`. */
  const pageScrollStickyPath = !grant && grain === "all-grants"
  /** My work needs visible overflow so row chip/button shadows aren’t clipped by the shell (see KPI strip). */
  const relaxShellOverflow = pageScrollStickyPath || grain === "command"

  useLayoutEffect(() => {
    const root = document.documentElement
    const bodyEl = document.body
    root.classList.add("mixed-scroll-sticky-compat")
    bodyEl.classList.add("mixed-scroll-sticky-compat")
    return () => {
      root.classList.remove("mixed-scroll-sticky-compat")
      bodyEl.classList.remove("mixed-scroll-sticky-compat")
    }
  }, [])

  return (
    <div
      className={cn(
        "shadow-bleed-scroll flex min-h-screen min-h-0 w-full flex-1 flex-row bg-white max-w-[100vw]",
        relaxShellOverflow ? "overflow-x-visible" : "overflow-x-hidden",
      )}
    >
      <ManagePrototypeSidebar
        grain={grain}
        onRequestGrain={(g) => {
          setGrain(g)
          setActiveGrantId(null)
        }}
        onClearGrant={() => setActiveGrantId(null)}
      />
      <div
        className={cn(
          "shadow-bleed-scroll flex min-h-0 min-w-0 flex-1 flex-col",
          relaxShellOverflow ? "overflow-x-visible" : "overflow-x-hidden",
        )}
      >
        <TopBar showNewGrant={!grant && grain === "all-grants"} />
        {grant ? (
          <GrainBar
            breadcrumb={{
              label: grant.title,
              onBack: closeGrant,
            }}
          />
        ) : null}

        <main
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-1 flex-col md:flex-row md:items-stretch",
            relaxShellOverflow ? "overflow-visible" : "overflow-hidden",
          )}
        >
          {grant ? (
            <div className="shadow-bleed-scroll min-h-0 min-w-0 flex-1 overflow-auto">
              <GrantPage grantId={grant.id} />
            </div>
          ) : (
            <>
              {/* Primary: greeting (My work) + KPIs + toggle + queue OR grants table only */}
              <section className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
                <div
                  className={cn(
                    MIXED_PRIMARY,
                    "flex min-h-0 min-w-0 flex-1 flex-col",
                    grain === "command" ? "pt-8 pb-6" : "pb-3 pt-2 md:pb-4 md:pt-3",
                  )}
                >
                  {/* Greeting collapses smoothly when switching to All grants (grid-rows 1fr → 0fr). */}
                  <div
                    className={cn(
                      "grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                      grain === "command" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="pb-6">
                        <Greeting attentionSummary={myWorkAttentionSummary} />
                      </div>
                    </div>
                  </div>

                  {grain === "command" ? (
                    <div className="relative mt-2 flex min-h-0 flex-1 flex-col overflow-visible">
                      <div className="shadow-bleed-scroll min-h-0 flex-1 overflow-auto overscroll-contain px-0 pb-10 [-webkit-overflow-scrolling:touch]">
                        <div className="mb-6">
                          <MyWorkAttentionStrip items={workQueue.items} />
                        </div>
                        <div className="sticky top-0 z-30 bg-background/95 pb-3 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 dark:bg-background/90">
                          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                            <GrainNavToggle active={grain} onChange={setGrain} size="panel" />
                            <MyWorkQueueToolbar
                              queueSort={workQueue.queueSort}
                              setQueueSort={workQueue.setQueueSort}
                              hideDone={workQueue.hideDone}
                              setHideDone={workQueue.setHideDone}
                            />
                          </div>
                        </div>
                        <div className="pt-3">
                          <CommandCenterWorkspace
                            onOpenGrant={openGrant}
                            myWorkQueue={workQueue}
                            operatorTaskQueue
                            stickyOperatorTableHeader
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={setGrantsScrollPort}
                      className="shadow-bleed-scroll flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
                    >
                      <div className="shrink-0 self-stretch px-2 pb-3 pt-5 sm:px-4 sm:pb-4 sm:pt-6">
                        <PulseStripRechartsStatic />
                      </div>
                      <div className="min-w-0 shrink-0">
                        <AllGrants
                          onOpenGrant={openGrant}
                          variant="operator"
                          flatChrome
                          showToolbarNewGrant={false}
                          pageScrollMode
                          pageScrollParent={grantsScrollEl}
                          stickyFilterPrefix={<GrainNavToggle active={grain} onChange={setGrain} size="panel" />}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Operator chat: outside primary shell; beside table, not under KPIs */}
              {(grain === "all-grants" || grain === "command") && operatorChatOpen ? (
                <aside className="relative z-[70] flex min-h-0 w-full shrink-0 flex-col overflow-visible bg-transparent px-0 pt-6 pb-6 md:h-full md:max-h-none md:max-w-[26rem] md:w-[min(26rem,32vw)] md:shrink-0 md:pl-1 md:pt-8 md:pb-6 md:pr-4 xl:pr-5">
                  <div className="operator-chat-enter flex h-[min(42vh,26rem)] max-h-[480px] min-h-[220px] w-full shrink-0 flex-col overflow-visible rounded-xl border border-elevated-stroke bg-background/95 shadow-sm backdrop-blur-sm dark:bg-card dark:shadow-sm md:h-full md:max-h-none md:min-h-0">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
                      <ChatPanelStandalone
                        variant="manage"
                        layout="embedded"
                        className="h-full min-h-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none backdrop-blur-none dark:bg-transparent"
                        contextLabel={contextLabel}
                        onClose={() => setOperatorChatOpen(false)}
                        title="Grants assistant"
                        initialMessages={elizabethAssistantInitialMessages}
                        suggestions={getManageAssistantSuggestions()}
                        onMixAltTaskAction={handleMixAltChatAction}
                      />
                    </div>
                  </div>
                </aside>
              ) : null}
            </>
          )}
        </main>

        {!grant && (grain === "all-grants" || grain === "command") && !operatorChatOpen ? (
          <button
            type="button"
            onClick={() => setOperatorChatOpen(true)}
            className="fixed right-4 bottom-4 z-50 group flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-lg ring-1 ring-border/40 transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--chart-1))",
            }}
            aria-label="Open grants assistant"
          >
            <FilledSparkle className="h-5 w-5 text-primary-foreground" aria-hidden />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-chart-3 ring-2 ring-background" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
