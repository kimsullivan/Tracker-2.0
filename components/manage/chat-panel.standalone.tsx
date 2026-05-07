"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FilledSparkle } from "@/components/ui/filled-sparkle"
import { Markdown } from "@/components/ui/markdown"
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import {
  ChatInlineViz,
  ChatSources,
  type ChatSource,
  type ChatTaskAction,
  type ChatViz,
} from "@/components/manage/chat-inline-viz"
import {
  mixAltOverspendSpendCharts,
  mixAltRacineGrantFollowUp,
  mixAltUnderspendSpendCharts,
  type MixAltAgentTurn,
  type MixAltEffect,
} from "@/components/manage/mix-alt-agent"

/** Matches main shell: TopBar (`h-11` = 2.75rem) + GrainBar (`h-9` = 2.25rem) + 12px breathing room */
const PANEL_TOP = "calc(2.75rem + 2.25rem + 12px)"
const PANEL_INSET = "16px"

export type StandaloneAgentMessage = {
  id: string
  role: "user" | "agent"
  body: string
  markdown: boolean
  at: number
  sources?: ChatSource[]
  viz?: ChatViz[]
}

type AgentMessage = StandaloneAgentMessage

const SUGGESTIONS = [
  "What changed since yesterday?",
  "Show everything blocked on the CFO",
  "Which grants are at risk this quarter?",
  "Reassign Maria's overflow",
]

/** First message for manage / mixed-shell embedded assistant (Elizabeth operator persona). */
export const ELIZABETH_GRANTS_ASSISTANT_INTRO =
  "Hi Elizabeth — I'm here to help manage the busywork behind your grants pipeline. Need to review deadlines, tidy up issues, export data, or narrow results? Just ask."

const INITIAL_ASSISTANT_MD = `Morning, Maria. The portfolio is roughly on track — pipeline weighted at **$2.91M** (down 4.2% week-over-week), win rate at 38% (+6 pts). The one thing that should jump first: **Hartford burn is 18% over plan** on DPP Y2.`

function defaultManageInitialMessages(): StandaloneAgentMessage[] {
  return [
    {
      id: "m0",
      role: "agent",
      markdown: true,
      at: Date.now(),
      body: INITIAL_ASSISTANT_MD,
      sources: [
        {
          title: "Portfolio snapshot",
          detail: "Command center · morning roll-up",
          href: "https://www.instrumentl.com/blog/grant-management/",
        },
        {
          title: "Hartford · DPP Y2",
          detail: "Burn vs plan (finance)",
          href: "https://www.figma.com",
        },
        {
          title: "Pipeline model",
          detail: "Weighted opportunities · trailing 8 wks",
          href: "https://www.instrumentl.com",
        },
      ],
      viz: [
        {
          kind: "metrics",
          rows: [
            { label: "Weighted pipeline", value: "$2.91M", hint: "−4.2% vs last week" },
            { label: "Win rate (90d)", value: "38%", hint: "+6 pts vs prior 90d" },
          ],
        },
        {
          kind: "sparkline",
          title: "Weighted pipeline trend",
          series: [
            { x: "W1", y: 3.25 },
            { x: "W2", y: 3.18 },
            { x: "W3", y: 3.12 },
            { x: "W4", y: 3.08 },
            { x: "W5", y: 3.02 },
            { x: "W6", y: 2.97 },
            { x: "W7", y: 2.94 },
            { x: "W8", y: 2.91 },
          ],
        },
      ],
    },
  ]
}

/** First thread + chips for the default manage / command-center assistant (Maria morning brief). */
export function getManageAssistantInitialMessages(): StandaloneAgentMessage[] {
  return defaultManageInitialMessages()
}

/** Grants assistant intro for mixed prototypes (Elizabeth, plain text — no KPI roll-up). */
export function getElizabethAssistantInitialMessages(): StandaloneAgentMessage[] {
  return [
    {
      id: "ea0",
      role: "agent",
      markdown: false,
      at: Date.now(),
      body: ELIZABETH_GRANTS_ASSISTANT_INTRO,
    },
  ]
}

export function getManageAssistantSuggestions(): string[] {
  return [...SUGGESTIONS]
}

/** Visible thinking dwell before exit animation + reply (ms) */
const THINKING_DELAY_MIN = 520
const THINKING_DELAY_SPREAD = 420

/** Fade-out of thinking UI before assistant message mounts */
const THINKING_EXIT_MS = 380

type ThinkingPhase = "idle" | "thinking" | "exiting"
/**
 * Target wall-clock duration for streaming (ms), scaled by token count, clamped.
 * Produces a steady rAF-driven reveal that feels faster than fixed per-token delays.
 */
function streamDurationForTokens(tokenCount: number, maxMs = 2350) {
  return Math.min(maxMs, Math.max(480, tokenCount * 14))
}

/** User bubble: light twilight wash + deepest twilight text (not primary purple) */
const USER_TWILIGHT_BUBBLE =
  "ml-auto max-w-[min(95%,18rem)] rounded-2xl px-3 py-2.5 text-right text-[14px] font-medium leading-snug " +
  "bg-gradient-to-br from-[hsl(252_48%_95%)] via-[hsl(265_42%_93%)] to-[hsl(248_50%_95%)] " +
  "text-[hsl(270_52%_11%)] shadow-sm ring-1 ring-[hsl(270_28%_72%)/0.4] " +
  "dark:from-[hsl(260_22%_23%)] dark:via-[hsl(270_20%_21%)] dark:to-[hsl(255_24%_24%)] " +
  "dark:text-[hsl(285_32%_88%)] dark:ring-white/12"

/** Mix Alt suggestion chips: compact, solid light twilight fill; hover is a shade darker only */
const MIX_ALT_SUGGESTION_CHIP =
  "rounded-full border border-twilight-200/65 bg-twilight-50 px-2.5 py-0.5 text-[12px] font-medium leading-snug text-twilight-350 " +
  "transition-[background-color,border-color] duration-150 ease-out " +
  "enabled:hover:border-twilight-200 enabled:hover:bg-twilight-100 " +
  "dark:border-twilight-350/40 dark:bg-twilight-350/12 dark:text-[hsl(285_32%_88%)] " +
  "dark:enabled:hover:border-twilight-350/50 dark:enabled:hover:bg-twilight-350/20"

/** How long each thinking-line stays visible before rotating (ms) */
const THINKING_ROTATION_MS = 700

const THINKING_STEPS = [
  {
    lead: "Thinking through your portfolio…",
    detail: "Cross-checking grants, pipeline signals, and ownership load.",
  },
  {
    lead: "Synthesizing signals…",
    detail: "Balancing federal exposure, capacity, and timing.",
  },
  {
    lead: "Almost ready…",
    detail: "Structuring the clearest next moves to surface for you.",
  },
] as const

function ThinkingShimmer() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % THINKING_STEPS.length)
    }, THINKING_ROTATION_MS)
    return () => clearInterval(id)
  }, [])

  const copy = THINKING_STEPS[step]

  return (
    <div className="bg-transparent px-0 py-1" aria-live="polite" aria-busy="true">
      <div className="space-y-1.5 bg-transparent" key={step}>
        <p className="chat-thinking-shimmer text-[13px] font-medium leading-snug md:text-[14px]">{copy.lead}</p>
        <p className="text-[11px] leading-snug text-muted-foreground/85 md:text-[12px]">{copy.detail}</p>
      </div>
    </div>
  )
}

/**
 * Smooth stream via rAF — duration scales with length so short replies snap in
 * and long ones stay readable without feeling sluggish.
 */
function StreamingAssistantMarkdown({
  text,
  className,
  onProgress,
  onComplete,
  maxStreamMs,
}: {
  text: string
  className?: string
  onProgress?: () => void
  onComplete?: () => void
  /** Upper bound for reveal duration (long operator briefs need more headroom) */
  maxStreamMs?: number
}) {
  const [visible, setVisible] = useState("")
  const [active, setActive] = useState(true)
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  onProgressRef.current = onProgress
  onCompleteRef.current = onComplete

  useEffect(() => {
    let cancelled = false
    let rafId = 0
    const tokens = text.split(/(\s+)/)
    const n = tokens.length
    setVisible("")
    setActive(true)

    const duration = streamDurationForTokens(n, maxStreamMs)
    const t0 = performance.now()
    let lastProgress = 0

    const frame = (now: number) => {
      if (cancelled) return
      const elapsed = now - t0
      const linearT = Math.min(1, elapsed / duration)
      const t = linearT * (2 - linearT)
      const i = Math.max(0, Math.ceil(t * n))
      setVisible(tokens.slice(0, i).join(""))
      if (now - lastProgress > 90) {
        lastProgress = now
        onProgressRef.current?.()
      }
      if (linearT < 1) {
        rafId = requestAnimationFrame(frame)
      } else {
        onProgressRef.current?.()
        setActive(false)
        onCompleteRef.current?.()
      }
    }

    rafId = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [text, maxStreamMs])

  return (
    <div className="relative min-w-0">
      <Markdown className={className}>{visible}</Markdown>
      {active ? (
        <span
          className="ml-px inline-block h-[1em] w-[2px] translate-y-px rounded-full bg-primary/45 align-middle"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

/** Same rAF reveal as markdown stream, for `scriptedAgentPlainText` replies (no ** parsing). */
function StreamingAssistantPlain({
  text,
  className,
  onProgress,
  onComplete,
  maxStreamMs,
}: {
  text: string
  className?: string
  onProgress?: () => void
  onComplete?: () => void
  maxStreamMs?: number
}) {
  const [visible, setVisible] = useState("")
  const [active, setActive] = useState(true)
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  onProgressRef.current = onProgress
  onCompleteRef.current = onComplete

  useEffect(() => {
    let cancelled = false
    let rafId = 0
    const tokens = text.split(/(\s+)/)
    const n = tokens.length
    setVisible("")
    setActive(true)

    const duration = streamDurationForTokens(n, maxStreamMs)
    const t0 = performance.now()
    let lastProgress = 0

    const frame = (now: number) => {
      if (cancelled) return
      const elapsed = now - t0
      const linearT = Math.min(1, elapsed / duration)
      const t = linearT * (2 - linearT)
      const i = Math.max(0, Math.ceil(t * n))
      setVisible(tokens.slice(0, i).join(""))
      if (now - lastProgress > 90) {
        lastProgress = now
        onProgressRef.current?.()
      }
      if (linearT < 1) {
        rafId = requestAnimationFrame(frame)
      } else {
        onProgressRef.current?.()
        setActive(false)
        onCompleteRef.current?.()
      }
    }

    rafId = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [text, maxStreamMs])

  return (
    <div className="relative min-w-0">
      <p className={className}>{visible}</p>
      {active ? (
        <span
          className="ml-px inline-block h-[1em] w-[2px] translate-y-px rounded-full bg-primary/45 align-middle"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

export function ChatPanelStandalone({
  contextLabel,
  onClose,
  variant = "manage",
  layout = "floating",
  initialMessages: initialMessagesProp,
  suggestions: suggestionsProp,
  title: titleProp,
  showCloseButton = true,
  streamMaxMs,
  className,
  scriptedTurn,
  onScriptedEffects,
  scriptedFallbackOnly,
  fallbackBody,
  onMixAltTaskAction,
  mixAltChartFollowUps,
  scriptedAgentPlainText,
  mixAltTwilightQuickPrompts,
}: {
  contextLabel: string
  onClose?: () => void
  variant?: "manage" | "operator"
  layout?: "floating" | "embedded"
  initialMessages?: StandaloneAgentMessage[]
  suggestions?: string[]
  title?: string
  showCloseButton?: boolean
  streamMaxMs?: number
  /** Merged onto the root panel; useful when embedding inside a parent frame */
  className?: string
  scriptedTurn?: (userText: string) => MixAltAgentTurn | null
  onScriptedEffects?: (effects: MixAltEffect[]) => void
  /** When true and `scriptedTurn` returns null, use `fallbackBody` instead of built-in `buildAgentReply`. */
  scriptedFallbackOnly?: boolean
  fallbackBody?: string
  /** Return true when handled (mixalt:// links). */
  onMixAltTaskAction?: (action: ChatTaskAction) => boolean
  /** Mix Alt: append spend pace charts for mixalt://chart/spend-* instead of toasts. */
  mixAltChartFollowUps?: boolean
  /** Mix Alt: agent replies render as plain text (no Markdown bold). */
  scriptedAgentPlainText?: boolean
  /** Mix Alt: twilight quick prompts; hover darkens fill slightly. */
  mixAltTwilightQuickPrompts?: boolean
}) {
  const [input, setInput] = useState("")
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>("idle")
  const [messages, setMessages] = useState<AgentMessage[]>(
    () => initialMessagesProp ?? defaultManageInitialMessages(),
  )
  const panelTitle = titleProp ?? (variant === "operator" ? "Operator" : "Grants assistant")
  const suggestionList = suggestionsProp ?? SUGGESTIONS
  const isEmbedded = layout === "embedded"
  const thinkingTimeoutsRef = useRef<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const clearThinkingTimeouts = useCallback(() => {
    thinkingTimeoutsRef.current.forEach(clearTimeout)
    thinkingTimeoutsRef.current = []
  }, [])

  useEffect(() => {
    return () => clearThinkingTimeouts()
  }, [clearThinkingTimeouts])

  const isThinkingBusy = thinkingPhase !== "idle"

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const handleTaskAction = useCallback(
    (action: ChatTaskAction) => {
      const href = action.href
      if (mixAltChartFollowUps) {
        if (href === "mixalt://chart/spend-underspend") {
          setMessages((prev) => [
            ...prev,
            {
              id: `mix-chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: "agent",
              markdown: false,
              at: Date.now(),
              body:
                "Cumulative spend vs expected pace (prototype). Metrics reflect the underspend scenario; lines show modeled burn as a percentage of the award.",
              viz: mixAltUnderspendSpendCharts(),
            },
          ])
          return
        }
        if (href === "mixalt://chart/spend-overspend") {
          setMessages((prev) => [
            ...prev,
            {
              id: `mix-chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: "agent",
              markdown: false,
              at: Date.now(),
              body:
                "Spend is ahead of the linear pace implied by elapsed grant time (prototype). Charts compare expected vs actual cumulative burn.",
              viz: mixAltOverspendSpendCharts(),
            },
          ])
          return
        }
      }
      if (onMixAltTaskAction?.(action)) return
      const { toastTitle, toastDescription, followUpBody } = taskFollowThrough(action)
      toast.success(toastTitle, { description: toastDescription })
      setMessages((prev) => [
        ...prev,
        {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "agent",
          markdown: true,
          at: Date.now(),
          body: followUpBody,
        },
      ])
    },
    [mixAltChartFollowUps, onMixAltTaskAction],
  )

  useEffect(() => {
    scrollToBottom()
  }, [messages, thinkingPhase, scrollToBottom])

  const send = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t || thinkingPhase !== "idle") return
      const userMsg: AgentMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        markdown: false,
        at: Date.now(),
        body: t,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      clearThinkingTimeouts()
      setThinkingPhase("thinking")

      const thinkMs = THINKING_DELAY_MIN + Math.floor(Math.random() * THINKING_DELAY_SPREAD)
      const t1 = window.setTimeout(() => {
        setThinkingPhase("exiting")
        const t2 = window.setTimeout(() => {
          const scripted = scriptedTurn?.(t)
          if (scripted) {
            if (scripted.effects.length && onScriptedEffects) {
              onScriptedEffects(scripted.effects)
            }
            const agentMd = !(scriptedAgentPlainText ?? false)
            const agentMsg: AgentMessage = {
              id: `a-${Date.now()}`,
              role: "agent",
              markdown: agentMd,
              at: Date.now(),
              body: scripted.agentBody,
              sources: scripted.sources,
              viz: scripted.viz,
            }
            setMessages((prev) => [...prev, agentMsg])
          } else if (scriptedFallbackOnly && fallbackBody !== undefined) {
            const agentMsg: AgentMessage = {
              id: `a-${Date.now()}`,
              role: "agent",
              markdown: !(scriptedAgentPlainText ?? false),
              at: Date.now(),
              body: fallbackBody,
            }
            setMessages((prev) => [...prev, agentMsg])
          } else {
            const reply = buildAgentReply(t, contextLabel)
            const agentMsg: AgentMessage = {
              id: `a-${Date.now()}`,
              role: "agent",
              markdown: true,
              at: Date.now(),
              body: reply.body,
              sources: reply.sources,
              viz: reply.viz,
            }
            setMessages((prev) => [...prev, agentMsg])
          }
          setThinkingPhase("idle")
        }, THINKING_EXIT_MS)
        thinkingTimeoutsRef.current.push(t2)
      }, thinkMs)
      thinkingTimeoutsRef.current.push(t1)
    },
    [thinkingPhase, contextLabel, clearThinkingTimeouts, scriptedTurn, onScriptedEffects, scriptedFallbackOnly, fallbackBody, scriptedAgentPlainText],
  )

  const mdClass = cn(
    "max-w-none text-[14px] leading-relaxed text-foreground/95",
    "prose prose-sm dark:prose-invert",
    "[&_p]:text-[14px] [&_li]:text-[14px] [&_h4]:text-[15px] [&_h3]:text-[15px]",
    "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_strong]:font-semibold [&_strong]:text-foreground",
  )

  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden backdrop-blur-md",
        isEmbedded
          ? "relative z-[70] h-full min-h-0 w-full max-w-none rounded-none border-0 bg-background shadow-none backdrop-blur-none dark:bg-background"
          : "rounded-2xl border border-border/60 bg-card/85 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.28)] dark:border-border/50 dark:bg-card/80 dark:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.55)] fixed z-50 w-[min(100vw-2rem,23rem)]",
        className,
      )}
      style={
        isEmbedded
          ? undefined
          : {
              top: PANEL_TOP,
              right: PANEL_INSET,
              bottom: PANEL_INSET,
            }
      }
      aria-label={`${panelTitle} — ${contextLabel}`}
    >
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-2",
          isEmbedded ? "px-5 py-4" : "px-4 py-3",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <FilledSparkle className="h-3 w-3 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">{panelTitle}</span>
        </div>
        {showCloseButton && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            aria-label={`Close assistant (context: ${contextLabel})`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          isEmbedded ? "px-5 pb-4 pt-2" : "px-4 pb-3 pt-1",
        )}
      >
        <div className="space-y-8">
          {messages.map((m) =>
            m.role === "agent" ? (
              <AgentMessageTurn
                key={m.id}
                m={m}
                mdClass={mdClass}
                scrollToBottom={scrollToBottom}
                maxStreamMs={streamMaxMs}
                panelVariant={variant}
                onTaskAction={handleTaskAction}
              />
            ) : (
              <div key={m.id} className="flex flex-col items-end gap-1">
                <p className={USER_TWILIGHT_BUBBLE}>{m.body}</p>
                <time
                  className="text-[11px] text-muted-foreground/80 tabular-nums"
                  dateTime={new Date(m.at).toISOString()}
                >
                  {new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
            ),
          )}

          {thinkingPhase !== "idle" ? (
            <div
              className={cn(
                "bg-transparent shadow-none",
                thinkingPhase === "thinking" && "thinking-enter-wrap",
                thinkingPhase === "exiting" && "thinking-exit-wrap",
              )}
            >
              <ThinkingShimmer />
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 flex flex-col",
          isEmbedded ? "px-4 py-4" : "px-3 py-3",
          isEmbedded ? "bg-background" : "bg-card/50 backdrop-blur-sm",
        )}
      >
        <div className="mb-2 flex flex-wrap gap-1">
          {suggestionList.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isThinkingBusy}
              onClick={() => send(s)}
              className={cn(
                "disabled:opacity-40",
                mixAltTwilightQuickPrompts
                  ? MIX_ALT_SUGGESTION_CHIP
                  : "rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <PromptInput
          className="rounded-2xl border-border/60 bg-background/90 shadow-sm"
          value={input}
          onValueChange={setInput}
          onSubmit={() => send(input)}
          isLoading={isThinkingBusy}
          disabled={isThinkingBusy}
          maxHeight={160}
        >
          <PromptInputTextarea
            placeholder="Ask anything…"
            className="text-[15px] text-[#333] placeholder:text-muted-foreground dark:text-neutral-200"
          />
          <PromptInputActions className="justify-end gap-2 px-1 pb-1">
            <Button
              type="button"
              size="icon"
              className="rounded-full"
              disabled={!input.trim() || isThinkingBusy}
              onClick={(e) => {
                e.stopPropagation()
                send(input)
              }}
            >
              <span className="sr-only">Send</span>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
          </PromptInputActions>
        </PromptInput>
      </div>
    </aside>
  )
}

function AgentMessageTurn({
  m,
  mdClass,
  scrollToBottom,
  maxStreamMs,
  panelVariant = "manage",
  onTaskAction,
}: {
  m: AgentMessage
  mdClass: string
  scrollToBottom: () => void
  maxStreamMs?: number
  panelVariant?: "manage" | "operator"
  onTaskAction?: (action: ChatTaskAction) => void
}) {
  const plainClass = "max-w-none whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/95"
  const [streamDone, setStreamDone] = useState(false)

  return (
    <article className="min-w-0">
      {m.markdown ? (
        <StreamingAssistantMarkdown
          text={m.body}
          className={mdClass}
          maxStreamMs={maxStreamMs}
          onProgress={scrollToBottom}
          onComplete={() => {
            setStreamDone(true)
            scrollToBottom()
          }}
        />
      ) : (
        <StreamingAssistantPlain
          text={m.body}
          className={plainClass}
          maxStreamMs={maxStreamMs}
          onProgress={scrollToBottom}
          onComplete={() => {
            setStreamDone(true)
            scrollToBottom()
          }}
        />
      )}
      {streamDone ? (
        <>
          {m.viz?.length ? (
            (() => {
              const kpiBlocks = m.viz.filter((b) => b.kind !== "tasks")
              const taskBlocks = m.viz.filter((b) => b.kind === "tasks")
              if (panelVariant === "operator") {
                if (!taskBlocks.length) return null
                return (
                  <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
                    {taskBlocks.map((block, i) => (
                      <ChatInlineViz
                        key={`${m.id}-viz-task-${i}`}
                        viz={block}
                        staggerMs={i * 100}
                        onTaskAction={onTaskAction}
                      />
                    ))}
                  </div>
                )
              }
              return (
                <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
                  {kpiBlocks.length ? (
                    <div className="space-y-3">
                      {kpiBlocks.map((block, i) => (
                        <ChatInlineViz key={`${m.id}-viz-kpi-${i}`} viz={block} staggerMs={i * 100} />
                      ))}
                    </div>
                  ) : null}
                  {taskBlocks.map((block, i) => (
                    <ChatInlineViz
                      key={`${m.id}-viz-task-${i}`}
                      viz={block}
                      staggerMs={(kpiBlocks.length + i) * 100}
                      onTaskAction={onTaskAction}
                    />
                  ))}
                </div>
              )
            })()
          ) : null}
          {m.sources?.length ? <ChatSources sources={m.sources} /> : null}
          <time
            className="mt-2 block text-[11px] text-muted-foreground/80 tabular-nums"
            dateTime={new Date(m.at).toISOString()}
          >
            {new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </time>
        </>
      ) : null}
    </article>
  )
}

function taskFollowThrough(action: ChatTaskAction): {
  toastTitle: string
  toastDescription: string
  followUpBody: string
} {
  const L = action.label.toLowerCase()
  if (L.includes("finance") && L.includes("loop")) {
    return {
      toastTitle: "Finance looped in",
      toastDescription: "Match-capacity thread updated — watch the grants inbox.",
      followUpBody:
        "**Loop in finance** — done. Finance is on the federal match-capacity thread (~$**370K** across three applications). **A. Park (Finance)** will follow up in the grants inbox.",
    }
  }
  if (L.includes("math") || L.includes("see the math")) {
    return {
      toastTitle: "Match model opened",
      toastDescription: "SAMHSA scenario tab pinned in the workbook.",
      followUpBody:
        "**See the math** — opened the match model workbook and pinned the **SAMHSA** scenario for you.",
    }
  }
  if (L.includes("draft") && L.includes("outreach")) {
    return {
      toastTitle: "Outreach draft started",
      toastDescription: "Template saved under Shared drafts.",
      followUpBody:
        "**Draft outreach** — started a **Skoll** intro draft from the Nina / Reyes template. Check **Shared drafts** for the editable version.",
    }
  }
  return {
    toastTitle: action.label,
    toastDescription: "Recorded in this workspace (prototype).",
    followUpBody: `**${action.label}** — recorded. In a live workspace this control would run the full workflow behind it.`,
  }
}

function buildAgentReply(
  userText: string,
  contextLabel: string,
): {
  body: string
  sources: ChatSource[]
  viz?: ChatViz[]
} {
  const t = userText.toLowerCase()

  if (t.includes("board meeting") || (t.includes("last board") && t.includes("changed"))) {
    return {
      body: `Since the last board meeting: federal exposure is **up 2.4× vs Q1**, awarded YTD sits at **$4.48M** (64% of plan), and three federal apps still hinge on **match-capacity clarity**. Biggest delta vs the deck you saw: **finance hasn’t locked matching funds** — that’s now the gating risk on SAMHSA.`,
      sources: [
        {
          title: "Board pack · Mar draft",
          detail: "Snapshot locked pre-Q2 pipeline shift",
          href: "https://www.instrumentl.com",
        },
        {
          title: "Federal pipeline workbook",
          detail: "Match scenarios · $370K ask",
          href: "https://www.figma.com",
        },
      ],
      viz: [
        {
          kind: "metrics",
          rows: [
            { label: "Awarded YTD", value: "$4.48M", hint: "vs $7M annual target" },
            { label: "Fed pipeline", value: "2.4×", hint: "vs Q1 baseline" },
          ],
        },
      ],
    }
  }

  if (
    t.includes("year-end") ||
    t.includes("year end") ||
    t.includes("where will we land") ||
    (t.includes("land") && t.includes("year"))
  ) {
    return {
      body: `If weighted pipeline closes at **87%**, we land near **$6.6–6.9M** awarded by FY-end — **at or slightly under** the **$7M** goal depending on timing on the federal cluster. The swing factor is **match availability**: losing SAMHSA-capacity takes ~**$400–550K** off the ceiling unless we backfill from Skoll / state.`,
      sources: [
        {
          title: "FY-end scenario model",
          detail: "Weighted + conservative close bands",
          href: "https://www.instrumentl.com",
        },
        {
          title: "Match-capacity memo",
          detail: "Finance dependency · draft",
          href: "https://www.github.com",
        },
      ],
      viz: [
        {
          kind: "sparkline",
          title: "Awarded run-rate vs target",
          series: [
            { x: "Q1", y: 3.9 },
            { x: "Q2", y: 4.3 },
            { x: "Now", y: 4.48 },
            { x: "Proj", y: 6.75 },
          ],
        },
      ],
    }
  }

  if (t.includes("draft") && t.includes("board")) {
    return {
      body: `**Board update — draft bullets**\n\n- **Trajectory**: 64% to **$7M** annual goal on awarded dollars; pipeline covers the gap at **87% close**.\n- **Upside / risk**: Federal pipeline **2.4× Q1**; match-capacity unresolved on **~$370K** across three apps.\n- **Decisions**: Confirm matching funds or sequence a pull (**SAMHSA** lowest fit).\n- **Leadership asks**: Skoll intro path (**M. Reyes / K. Chen**); capacity check on **Maria** (142% · 3 wks).`,
      sources: [
        {
          title: "Slide outline",
          detail: "Board deck · v0",
          href: "https://www.figma.com",
        },
      ],
      viz: [
        {
          kind: "metrics",
          rows: [
            { label: "Board pack status", value: "Draft", hint: "Needs finance sign-off" },
            { label: "Critical decisions", value: "2", hint: "Match + Skoll path" },
          ],
        },
      ],
    }
  }

  if (t.includes("changed") || t.includes("yesterday")) {
    return {
      body: `Since yesterday: **3 status changes**, **2 new notes**, **1 drawdown approved** (CA Endowment, $87.5K). Hartford crossed the 18% over-plan threshold this morning.`,
      sources: [
        {
          title: "Activity feed",
          detail: "Portfolio-wide · last 24h",
          href: "https://www.github.com",
        },
        {
          title: "CA Endowment drawdown",
          detail: "Treasury · approved payment log",
          href: "https://www.instrumentl.com",
        },
        {
          title: "Hartford burn alert",
          detail: "Budget vs actual · DPP Y2",
          href: "https://www.figma.com",
        },
      ],
      viz: [
        {
          kind: "metrics",
          rows: [
            { label: "Status moves", value: "3", hint: "since yesterday" },
            { label: "Drawdowns cleared", value: "$87.5K", hint: "CA Endowment" },
          ],
        },
      ],
    }
  }

  if (t.includes("blocked")) {
    return {
      body: `One grant is hard-blocked on the CFO right now: **Mental Health First Aid Training** — awaiting James's budget sign-off on the logic model. Last ping was Apr 30. Want me to nudge him?`,
      sources: [
        {
          title: "MHFA Training",
          detail: "Grant record · stage & blockers",
          href: "https://www.wikipedia.org",
        },
        {
          title: "James · CFO queue",
          detail: "Approval inbox snapshot",
          href: "https://www.google.com",
        },
      ],
      viz: [
        {
          kind: "sparkline",
          title: "Days waiting on CFO (similar grants)",
          series: [
            { x: "M", y: 5 },
            { x: "T", y: 7 },
            { x: "W", y: 8 },
            { x: "T", y: 9 },
            { x: "F", y: 11 },
            { x: "S", y: 11 },
            { x: "S", y: 12 },
          ],
        },
      ],
    }
  }

  if (t.includes("at risk") || t.includes("risk")) {
    return {
      body: `Three at-risk items this quarter: **Hartford burn** (crit), **Kresge silence** (warn), and **Cummings LOI capacity**. Hartford is the only one that could affect funding.`,
      sources: [
        {
          title: "Risk register",
          detail: "Quarterly portfolio risk · Q view",
          href: "https://ibelick.com",
        },
        {
          title: "Hartford · Kresge · Cummings",
          detail: "Grant files linked from pulse strip",
          href: "https://www.instrumentl.com",
        },
      ],
      viz: [
        {
          kind: "metrics",
          rows: [
            { label: "Critical", value: "1", hint: "Hartford burn" },
            { label: "Warn", value: "2", hint: "Kresge, Cummings" },
          ],
        },
      ],
    }
  }

  if (t.includes("reassign") || t.includes("overflow")) {
    return {
      body: `Maria is at **142% load**. Recommend moving the **Cummings LOI** to Grace (**88% load**, has capacity). That brings Maria to **121%**, still hot but workable.`,
      sources: [
        {
          title: "Team capacity model",
          detail: "Owner load · rolling 30d",
          href: "https://www.figma.com",
        },
        {
          title: "Cummings LOI",
          detail: "Grant routing · editable owners",
          href: "https://www.github.com",
        },
      ],
      viz: [
        {
          kind: "sparkline",
          title: "Maria vs Grace load index",
          series: [
            { x: "W1", y: 118 },
            { x: "W2", y: 128 },
            { x: "W3", y: 135 },
            { x: "W4", y: 142 },
          ],
        },
      ],
    }
  }

  if (t.includes("why") && (t.includes("racine") || t.includes("underspend"))) {
    const racineNamed = t.includes("racine")
    return {
      body: racineNamed
        ? `**Racine Community Foundation** is flagged because spend is behind expected pace for this stage of the grant: **40%** of the budget used with **80%** of the period elapsed. We flag underspend when usage is more than **20 percentage points** behind a linear pace. The metrics below show the spenddown picture as a share of the award.`
        : `This grant is flagged because spend is behind expected pace: **40%** of the budget used with **80%** of the period elapsed. We flag underspend when usage is more than **20 percentage points** behind linear pace — see metrics below.`,
      sources: racineNamed
        ? [
            {
              title: "Racine Community Foundation",
              detail: "Award · spend vs period (prototype)",
              href: "https://www.instrumentl.com",
            },
          ]
        : [
            {
              title: "Spend flags · portfolio rules",
              detail: "Underspend threshold (prototype)",
              href: "https://www.instrumentl.com",
            },
          ],
      viz: [...mixAltUnderspendSpendCharts(), mixAltRacineGrantFollowUp()],
    }
  }

  return {
    body: `I can pull data on any of your **21 active grants**, draft responses, or move work between teammates. Try the suggestion chips below or ask something specific.`,
    sources: [
      {
        title: "Grants index",
        detail: "All active grants · Manage workspace",
        href: "https://www.instrumentl.com",
      },
      {
        title: contextLabel.slice(0, 40) + (contextLabel.length > 40 ? "…" : ""),
        detail: "Current UI context (breadcrumb)",
        href: `https://www.google.com/search?q=${encodeURIComponent(contextLabel)}`,
      },
    ],
    viz: [
      {
        kind: "metrics",
        rows: [
          { label: "Active grants", value: "21", hint: "non-closed" },
          { label: "Context", value: contextLabel.slice(0, 18) + (contextLabel.length > 18 ? "…" : ""), hint: "from nav" },
        ],
      },
    ],
  }
}
