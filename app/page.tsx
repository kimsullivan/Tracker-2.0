"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FilledSparkle } from "@/components/ui/filled-sparkle"
import { TopBar } from "@/components/manage/top-bar"
import { GrainBar, type Grain } from "@/components/manage/grain-bar"
import { CommandCenter } from "@/components/manage/command-center"
import { AllGrants } from "@/components/manage/all-grants"
import { GrantDetailsPage } from "@/components/manage/grant-details-page"
import { AgentRail } from "@/components/manage/agent-rail"
import { ChatPanelStandalone } from "@/components/manage/chat-panel.standalone"
import { MixedPrototype } from "@/components/manage/mixed-prototype"
import { MixedPrototypeAlt } from "@/components/manage/mixed-prototype-alt"
import { OPERATOR_INITIAL_MESSAGES, OPERATOR_SUGGESTIONS } from "@/components/manage/operator-initial"
import { grants } from "@/lib/manage/data"
import { grantDisplayTitle } from "@/lib/manage/grant-context"
import type { IssueNavigationContext } from "@/lib/manage/types"
import { ManagePrototypeSidebar } from "@/components/sidebar/manage-prototype-sidebar"
import { ApplicationCyclesDemoProvider } from "@/components/manage/application-cycles-demo-context"

function StaticCommandCenter() {
  const [grain, setGrain] = useState<Grain>("all-grants")
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null)
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

  return (
    <ApplicationCyclesDemoProvider>
    <div className="shadow-bleed-scroll flex min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-white">
      <ManagePrototypeSidebar
        grain={grain}
        onRequestGrain={(g) => {
          setGrain(g)
          setActiveGrantId(null)
        }}
        onClearGrant={() => setActiveGrantId(null)}
      />
      <div className="shadow-bleed-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <TopBar showNewGrant={!grant && grain === "all-grants"} />
        <GrainBar
          active={grain}
          onChange={(g) => {
            setGrain(g)
            setActiveGrantId(null)
          }}
          breadcrumb={
            grant
              ? {
                  label: grantDisplayTitle(grant),
                  onBack: closeGrant,
                }
              : null
          }
        />

        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          {grant ? (
            <div className="shadow-bleed-scroll min-h-0 min-w-0 flex-1 overflow-auto">
              <GrantDetailsPage
                grantId={grant.id}
                issueHighlight={issueNav}
                onDismissHighlight={() => setIssueNav(null)}
              />
            </div>
          ) : grain === "command" ? (
            <div className="shadow-bleed-scroll min-h-0 min-w-0 flex-1 overflow-auto">
              <CommandCenter onOpenGrant={openGrant} />
            </div>
          ) : (
            <div className="shadow-bleed-scroll min-h-0 min-w-0 flex-1 overflow-auto">
              <AllGrants
                onOpenGrant={openGrant}
                showToolbarNewGrant={grant !== null || grain !== "all-grants"}
              />
            </div>
          )}
        </main>

        <AgentRail contextLabel={contextLabel} />
      </div>
    </div>
    </ApplicationCyclesDemoProvider>
  )
}

/** Operator prototype: All grants + embedded operator chat in-page (not an overlay). */
function OperatorAllGrants() {
  const router = useRouter()
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null)
  const [operatorChatOpen, setOperatorChatOpen] = useState(true)
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

  const contextLabel = grant ? grantDisplayTitle(grant) : "All grants table"

  return (
    <ApplicationCyclesDemoProvider>
    <div className="shadow-bleed-scroll flex min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-white">
      <ManagePrototypeSidebar
        grain="all-grants"
        onRequestGrain={(g) => {
          if (g === "command") router.push("/")
        }}
        onClearGrant={closeGrant}
      />
      <div className="shadow-bleed-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <TopBar showNewGrant={!grant} showBottomStroke={false} />
        {grant ? (
          <GrainBar
            breadcrumb={{
              label: grantDisplayTitle(grant),
              onBack: closeGrant,
            }}
          />
        ) : null}

        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          {grant ? (
            <div className="shadow-bleed-scroll min-h-0 min-w-0 flex-1 overflow-auto">
              <GrantDetailsPage
                grantId={grant.id}
                issueHighlight={issueNav}
                onDismissHighlight={() => setIssueNav(null)}
              />
            </div>
          ) : (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6 p-6 md:flex-row">
              <div className="shadow-bleed-scroll relative z-0 order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <AllGrants
                  onOpenGrant={openGrant}
                  variant="operator"
                  flatChrome
                  showToolbarNewGrant={false}
                />
              </div>
              {operatorChatOpen ? (
                <div className="operator-chat-enter relative z-[70] order-2 flex h-[min(42vh,26rem)] max-h-[480px] min-h-[220px] w-full shrink-0 flex-col overflow-visible rounded-xl border border-twilight-200 bg-white shadow-[0_14px_44px_-10px_rgba(61,58,138,0.22)] md:h-full md:max-h-none md:min-h-0 md:w-[min(26rem,34vw)] md:max-w-[26rem] md:shrink-0 dark:border-twilight-350/35 dark:shadow-[0_18px_56px_-12px_rgba(61,58,138,0.42)]">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
                  <ChatPanelStandalone
                    variant="operator"
                    layout="embedded"
                    className="h-full min-h-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none backdrop-blur-none dark:bg-transparent"
                    contextLabel={contextLabel}
                    onClose={() => setOperatorChatOpen(false)}
                    title="Operator"
                    initialMessages={OPERATOR_INITIAL_MESSAGES}
                    suggestions={OPERATOR_SUGGESTIONS}
                    streamMaxMs={5600}
                  />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </main>

        {!grant && !operatorChatOpen ? (
          <button
            type="button"
            onClick={() => setOperatorChatOpen(true)}
            className="fixed right-4 bottom-4 z-50 group flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-lg ring-1 ring-border/40 transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--chart-1))",
            }}
            aria-label="Open operator chat"
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

function PageContent() {
  const searchParams = useSearchParams()
  const prototype = searchParams.get("prototype")
  if (prototype === "operator") {
    return <OperatorAllGrants />
  }
  if (prototype === "mixed") {
    return <MixedPrototype />
  }
  if (prototype === "static") {
    return <StaticCommandCenter />
  }
  /** Default home: Mixed alt (`?prototype=mixed-alt` still supported for bookmarks). */
  return <MixedPrototypeAlt />
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full flex-col bg-white">
          <div className="h-14 border-b border-border bg-white" />
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        </div>
      }
    >
      <PageContent />
    </Suspense>
  )
}
