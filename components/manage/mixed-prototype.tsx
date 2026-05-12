"use client"

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { FilledSparkle } from "@/components/ui/filled-sparkle"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { TopBar } from "@/components/manage/top-bar"
import { GrainBar, GrainNavToggle, type Grain } from "@/components/manage/grain-bar"
import { CommandCenterWorkspace, Greeting, MyWorkAttentionStrip, useMyWorkQueueState } from "@/components/manage/command-center"
import { AllGrants, type AllGrantsFilterApi } from "@/components/manage/all-grants"
import { PulseStripRechartsStatic } from "@/components/manage/all-grants-kpi-tiles"
import { GrantDetailsPage } from "@/components/manage/grant-details-page"
import {
  ChatPanelStandalone,
  getElizabethAssistantInitialMessages,
  type ChatPanelStandaloneHandle,
} from "@/components/manage/chat-panel.standalone"
import type { ChatTaskAction } from "@/components/manage/chat-inline-viz"
import type { Grant, IssueNavigationContext } from "@/lib/manage/types"
import { grants } from "@/lib/manage/data"
import { grantDisplayTitle } from "@/lib/manage/grant-context"
import { ManagePrototypeSidebar } from "@/components/sidebar/manage-prototype-sidebar"
import { ApplicationCyclesDemoProvider } from "@/components/manage/application-cycles-demo-context"
import { defaultTimeRangeFilterPatch } from "@/lib/manage/time-range-filter"
import {
  getMixAltSuggestions,
  isEffectiveUpcoming,
  matchDiscoveryGrants,
  matchMixAltAgentTurn,
  mixAltFallbackBody,
  countTableLayoutEffects,
  fiscalYearLabelsForGrants,
  type MixAltEffect,
} from "@/components/manage/mix-alt-agent"

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
  const [tableScopeGrants, setTableScopeGrants] = useState<Grant[]>(grants)
  const [currentViewLabel, setCurrentViewLabel] = useState("All grants")

  const filterApiRef = useRef<AllGrantsFilterApi | null>(null)
  const chatPanelRef = useRef<ChatPanelStandaloneHandle>(null)
  const [upcomingThresholdDays, setUpcomingThresholdDays] = useState(14)
  const [snoozedIssueIds, setSnoozedIssueIds] = useState(() => new Set<string>())
  const [discovery, setDiscovery] = useState({ deadlineNextMonth: false, tasksNone: false })
  const [chatSavedViews, setChatSavedViews] = useState<string[]>([])
  const [saveViewNudgeSeq, setSaveViewNudgeSeq] = useState(0)
  const tableLayoutAccumRef = useRef(0)
  const [issueNav, setIssueNav] = useState<IssueNavigationContext | null>(null)

  const grant = activeGrantId ? grants.find((g) => g.id === activeGrantId) : null

  function openGrant(id: string, ctx?: IssueNavigationContext) {
    setActiveGrantId(id)
    setIssueNav(ctx ?? null)
  }

  function closeGrant() {
    setActiveGrantId(null)
    setIssueNav(null)
  }

  const contextLabel = grant ? grantDisplayTitle(grant) : grain === "command" ? "My work" : "All grants table"

  const workQueue = useMyWorkQueueState()

  const elizabethAssistantInitialMessages = useMemo(() => getElizabethAssistantInitialMessages(), [])

  const chatSuggestions = useMemo(() => getMixAltSuggestions({ grain, operatorViewId: "all" }), [grain])

  useLayoutEffect(() => {
    if (grain !== "all-grants") tableLayoutAccumRef.current = 0
  }, [grain])

  const agentSnapshot = useCallback((): Parameters<typeof matchMixAltAgentTurn>[1] => {
    return {
      filteredBaseGrants: tableScopeGrants,
      tableScopeGrants,
      workQueueItems: workQueue.items,
      upcomingThresholdDays,
      snoozedIssueIds,
      lastIssueContext: null,
      activeGrantTitle: grant?.title ?? null,
      currentViewLabel,
      discoveryDeadlineNextMonth: discovery.deadlineNextMonth,
      discoveryTasksNone: discovery.tasksNone,
      chatSavedViewLabels: chatSavedViews,
      fiscalYearLabels: fiscalYearLabelsForGrants(grants),
      grain,
      operatorViewId: "all",
    }
  }, [
    tableScopeGrants,
    workQueue.items,
    upcomingThresholdDays,
    snoozedIssueIds,
    grant,
    currentViewLabel,
    discovery.deadlineNextMonth,
    discovery.tasksNone,
    chatSavedViews,
    grain,
  ])

  const applyMixAltEffects = useCallback(
    (effects: MixAltEffect[]) => {
      for (const e of effects) {
        switch (e.type) {
          case "set_owner_filter":
            queueMicrotask(() => filterApiRef.current?.setFilters({ owner: e.ownerId }))
            break
          case "clear_owner_filter":
            filterApiRef.current?.setFilters({ owner: null })
            break
          case "set_foundation_filter":
            filterApiRef.current?.setFilters({ funderType: "Private" })
            break
          case "clear_foundation_filter":
            filterApiRef.current?.setFilters({ funderType: null })
            break
          case "set_threshold":
            setUpcomingThresholdDays(e.days)
            break
          case "snooze_upcoming": {
            const ids = workQueue.items
              .filter((i) => isEffectiveUpcoming(i, upcomingThresholdDays, snoozedIssueIds))
              .map((i) => i.id)
            const snapshotItems = workQueue.items.map((i) => ({ ...i }))
            workQueue.setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, snoozed: true } : i)))
            setSnoozedIssueIds((prev) => new Set([...prev, ...ids]))
            const n = ids.length
            toast.success(`${n} issues snoozed`, {
              action: {
                label: "Undo",
                onClick: () => {
                  workQueue.setItems(snapshotItems)
                  setSnoozedIssueIds((prev) => {
                    const next = new Set(prev)
                    for (const id of ids) next.delete(id)
                    return next
                  })
                },
              },
            })
            break
          }
          case "set_discovery":
            setDiscovery({ deadlineNextMonth: e.deadlineNextMonth, tasksNone: e.tasksNone })
            break
          case "clear_discovery":
            setDiscovery({ deadlineNextMonth: false, tasksNone: false })
            break
          case "add_saved_view_label":
            setChatSavedViews((prev) => [...prev, e.label])
            filterApiRef.current?.saveNamedView(e.label)
            break
          case "open_save_view_dialog":
            queueMicrotask(() =>
              filterApiRef.current?.openSaveViewDialog(
                e.suggestedName ? { suggestedName: e.suggestedName } : undefined,
              ),
            )
            break
          case "set_group_by":
            queueMicrotask(() => filterApiRef.current?.setGroupBy(e.groupBy))
            break
          case "clear_grant_toolbar_filters":
            queueMicrotask(() => filterApiRef.current?.clearToolbarFilters())
            break
          case "set_funder_type_filter":
            queueMicrotask(() => filterApiRef.current?.setFilters({ funderType: e.funderType }))
            break
          case "set_sort":
            queueMicrotask(() => filterApiRef.current?.setSort(e.column, e.dir))
            break
          case "set_fiscal_year_filter": {
            const fy = e.fiscalYear
            if (fy == null || fy === "") {
              queueMicrotask(() => filterApiRef.current?.setFilters({ ...defaultTimeRangeFilterPatch() }))
            } else {
              const m = /^FY(\d{4})$/.exec(String(fy).trim())
              const y = m?.[1]
              queueMicrotask(() =>
                filterApiRef.current?.setFilters(
                  y
                    ? {
                        timeRangePreset: `fy${y}`,
                        timeRangeCustomStart: null,
                        timeRangeCustomEnd: null,
                      }
                    : { ...defaultTimeRangeFilterPatch() },
                ),
              )
            }
            break
          }
          case "set_column_visible":
            queueMicrotask(() => filterApiRef.current?.setColumnVisible(e.column, e.visible))
            break
          case "move_column_before":
            queueMicrotask(() => filterApiRef.current?.moveColumnBefore(e.moved, e.before))
            break
          case "move_column_after":
            queueMicrotask(() => filterApiRef.current?.moveColumnAfter(e.moved, e.after))
            break
          case "set_pipeline_fourth_metric":
            break
        }
      }
      const n = countTableLayoutEffects(effects)
      if (n > 0 && grain === "all-grants") {
        tableLayoutAccumRef.current += n
        if (tableLayoutAccumRef.current >= 3) {
          tableLayoutAccumRef.current = 0
          setSaveViewNudgeSeq((s) => s + 1)
        }
      }
    },
    [workQueue, upcomingThresholdDays, snoozedIssueIds, grain],
  )

  const extraGrantFilter = useMemo(() => {
    if (!discovery.deadlineNextMonth && !discovery.tasksNone) return null
    return (g: Grant) =>
      matchDiscoveryGrants([g], workQueue.items, discovery.deadlineNextMonth, discovery.tasksNone).length > 0
  }, [discovery.deadlineNextMonth, discovery.tasksNone, workQueue.items])

  const handleMixAltChatAction = useCallback(
    (action: ChatTaskAction): boolean => {
      const href = action.href
      if (!href.startsWith("mixalt://")) return false
      const rest = href.slice("mixalt://".length)
      if (rest.startsWith("grant/")) {
        const tail = rest.slice("grant/".length)
        const [rawId, ...tabParts] = tail.split("/")
        const grantId = decodeURIComponent(rawId)
        const tab = tabParts[0]
        if (tab === "financials") {
          openGrant(grantId, {
            fieldKey: "budget_spend",
            fieldLabel: "Spenddown pace",
            reason: "Tracking ~$25K below plan — review burn vs. expected.",
          })
        } else {
          openGrant(grantId)
        }
        return true
      }
      if (rest === "open-save-view") {
        filterApiRef.current?.openSaveViewDialog()
        return true
      }
      if (rest.startsWith("open-save-view/suggested/")) {
        const name = decodeURIComponent(rest.slice("open-save-view/suggested/".length))
        filterApiRef.current?.openSaveViewDialog({ suggestedName: name })
        return true
      }
      if (rest.startsWith("run-lens-export/")) {
        const fmt = rest.slice("run-lens-export/".length)
        if (fmt === "pdf" || fmt === "csv") {
          filterApiRef.current?.exportLensReport(fmt, { silent: true })
          return true
        }
      }
      if (rest.startsWith("export-audience/")) {
        return true
      }
      if (rest === "dismiss-save-nudge") {
        return true
      }
      return false
    },
    [openGrant],
  )

  const myWorkAttentionSummary = useMemo(
    () => (
      <>
        <span className="text-foreground">Hartford LOI is your only hard deadline today.</span> Maria&apos;s overload is
        the call worth making.
        {workQueue.hygienePendingCount > 0 ? ` ${workQueue.hygienePendingCount} data gaps can wait.` : null}
      </>
    ),
    [workQueue.hygienePendingCount],
  )

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
    <ApplicationCyclesDemoProvider>
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
              label: grantDisplayTitle(grant),
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
              <GrantDetailsPage
                grantId={grant.id}
                issueHighlight={issueNav}
                onDismissHighlight={() => setIssueNav(null)}
              />
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
                  {/* Greeting height animates when switching My work ↔ All grants (grid 1fr → 0fr). */}
                  <div
                    className={cn(
                      "grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                      grain === "command" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="pb-2">
                        <Greeting attentionSummary={myWorkAttentionSummary} />
                      </div>
                    </div>
                  </div>

                  {grain === "command" ? (
                    <div className="relative mt-1 flex min-h-0 flex-1 flex-col overflow-visible">
                      <div className="shadow-bleed-scroll min-h-0 flex-1 overflow-auto overscroll-contain px-0 pb-10 [-webkit-overflow-scrolling:touch]">
                        <div className="sticky top-0 z-30 mb-2 bg-background/95 pb-3 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 dark:bg-background/90">
                          <GrainNavToggle active={grain} onChange={setGrain} size="panel" />
                        </div>
                        <div className="mb-6">
                          <MyWorkAttentionStrip items={workQueue.items} />
                        </div>
                        <div className="pt-3">
                          <CommandCenterWorkspace
                            onOpenGrant={openGrant}
                            myWorkQueue={workQueue}
                            operatorTaskQueue
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={setGrantsScrollPort}
                      className="shadow-bleed-scroll flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
                    >
                      <div className="shrink-0 self-stretch px-2 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
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
                          onFilteredBaseChange={setTableScopeGrants}
                          onViewLabelChange={setCurrentViewLabel}
                          extraGrantFilter={extraGrantFilter}
                          onRegisterFilterApi={(api) => {
                            filterApiRef.current = api
                          }}
                          onOperatorSaveViewCommitted={(name) => {
                            setChatSavedViews((prev) => (prev.includes(name) ? prev : [...prev, name]))
                            chatPanelRef.current?.appendAgentMessage(
                              `Saved "${name}" — it’s in your View menu with filters, grouping, columns, and sort.`,
                            )
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Operator chat: outside primary shell; beside table, not under KPIs */}
              {(grain === "all-grants" || grain === "command") && operatorChatOpen ? (
                <aside className="relative z-[70] flex min-h-0 w-full shrink-0 flex-col overflow-visible bg-transparent px-0 pt-5 pb-6 md:h-full md:max-h-none md:max-w-[26rem] md:w-[min(26rem,32vw)] md:shrink-0 md:pl-1 md:pt-5 md:pb-6 md:pr-4 xl:pr-5">
                  <div className="operator-chat-enter flex h-[min(42vh,26rem)] max-h-[480px] min-h-[220px] w-full shrink-0 flex-col overflow-visible rounded-xl border border-elevated-stroke bg-background/95 shadow-sm backdrop-blur-sm dark:bg-card dark:shadow-sm md:h-auto md:max-h-none md:min-h-0 md:flex-1">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
                      <ChatPanelStandalone
                        ref={chatPanelRef}
                        variant="manage"
                        layout="embedded"
                        className="h-full min-h-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none backdrop-blur-none dark:bg-transparent"
                        contextLabel={contextLabel}
                        onClose={() => setOperatorChatOpen(false)}
                        title="Grants assistant"
                        initialMessages={elizabethAssistantInitialMessages}
                        suggestions={chatSuggestions}
                        scriptedTurn={(text) => matchMixAltAgentTurn(text, agentSnapshot())}
                        onScriptedEffects={applyMixAltEffects}
                        scriptedFallbackOnly
                        fallbackBody={mixAltFallbackBody()}
                        mixAltChartFollowUps
                        scriptedAgentPlainText
                        mixAltTwilightQuickPrompts
                        onMixAltTaskAction={handleMixAltChatAction}
                        saveViewNudgeSeq={saveViewNudgeSeq}
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
    </ApplicationCyclesDemoProvider>
  )
}
