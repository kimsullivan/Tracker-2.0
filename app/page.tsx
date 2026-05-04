"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles } from "lucide-react"
import { TopBar } from "@/components/manage/top-bar"
import { GrainBar, type Grain } from "@/components/manage/grain-bar"
import { CommandCenter } from "@/components/manage/command-center"
import { AllGrants } from "@/components/manage/all-grants"
import { GrantPage } from "@/components/manage/grant-page"
import { AgentRail } from "@/components/manage/agent-rail"
import { ChatPanelStandalone } from "@/components/manage/chat-panel.standalone"
import { OPERATOR_INITIAL_MESSAGES, OPERATOR_SUGGESTIONS } from "@/components/manage/operator-initial"
import { grants } from "@/lib/manage/data"
import { ManagePrototypeSidebar } from "@/components/sidebar/manage-prototype-sidebar"

function StaticCommandCenter() {
  const [grain, setGrain] = useState<Grain>("command")
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null)

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
      ? "Portfolio overview"
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
        <TopBar />
        <GrainBar
          active={grain}
          onChange={(g) => {
            setGrain(g)
            setActiveGrantId(null)
          }}
          breadcrumb={
            grant
              ? {
                  label: grant.title,
                  onBack: closeGrant,
                }
              : null
          }
        />

        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          {grant ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <GrantPage grantId={grant.id} />
            </div>
          ) : grain === "command" ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <CommandCenter onOpenGrant={openGrant} />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <AllGrants onOpenGrant={openGrant} />
            </div>
          )}
        </main>

        <AgentRail contextLabel={contextLabel} />
      </div>
    </div>
  )
}

/** Operator prototype: All grants + embedded operator chat in-page (not an overlay). */
function OperatorAllGrants() {
  const router = useRouter()
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null)
  const [operatorChatOpen, setOperatorChatOpen] = useState(true)

  const grant = activeGrantId ? grants.find((g) => g.id === activeGrantId) : null

  function openGrant(id: string) {
    setActiveGrantId(id)
  }

  function closeGrant() {
    setActiveGrantId(null)
  }

  const contextLabel = grant ? grant.title : "All grants table"

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-background">
      <ManagePrototypeSidebar
        grain="all-grants"
        onRequestGrain={(g) => {
          if (g === "command") router.push("/")
        }}
        onClearGrant={closeGrant}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <TopBar />
        {grant ? (
          <GrainBar
            breadcrumb={{
              label: grant.title,
              onBack: closeGrant,
            }}
          />
        ) : null}

        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          {grant ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <GrantPage grantId={grant.id} />
            </div>
          ) : (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
              <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <AllGrants
                  onOpenGrant={openGrant}
                  variant="operator"
                  operatorChatOpen={operatorChatOpen}
                />
              </div>
              {operatorChatOpen ? (
                <div className="operator-chat-enter order-2 flex h-[min(42vh,26rem)] max-h-[480px] min-h-[220px] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background md:h-full md:max-h-none md:min-h-0 md:w-[min(26rem,34vw)] md:max-w-[26rem] md:shrink-0">
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
            <Sparkles className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-chart-3 ring-2 ring-background" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PageContent() {
  const searchParams = useSearchParams()
  if (searchParams.get("prototype") === "operator") {
    return <OperatorAllGrants />
  }
  return <StaticCommandCenter />
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full flex-col bg-background">
          <div className="h-14 bg-sidebar/95" />
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        </div>
      }
    >
      <PageContent />
    </Suspense>
  )
}
