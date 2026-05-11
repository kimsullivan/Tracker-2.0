"use client"

import { ArrowRight } from "lucide-react"
import { FilledSparkle } from "@/components/ui/filled-sparkle"
import { cn } from "@/lib/utils"

type PipelineInsightBannerProps = {
  onExplainMore: () => void
}

export function PipelineInsightBanner({ onExplainMore }: PipelineInsightBannerProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-twilight-200/80 px-3 py-[14px]",
        "bg-gradient-to-br from-twilight-50 via-[hsl(270_55%_99%)] to-[hsl(252_48%_96%)]",
        "dark:border-twilight-350/40 dark:from-twilight-350/14 dark:via-card dark:to-twilight-350/10",
      )}
    >
      <FilledSparkle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">
          Win rate +9 pts — narrow pipeline
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <span>
            {
              "You're winning 31% vs 22% last period — strong gains. But 78% of prospects are Private funders and $0 is in flight from Federal or State sources."
            }
          </span>
          <button
            type="button"
            onClick={onExplainMore}
            className={cn(
              "ml-[8px] inline-flex h-6 shrink-0 items-center gap-0.5 align-middle rounded-md border border-twilight-200/90 bg-transparent px-1.5 text-[12px] font-medium text-foreground",
              "transition-colors hover:bg-twilight-50/80 dark:border-twilight-350/50 dark:hover:bg-twilight-350/12",
            )}
          >
            Explain more
            <ArrowRight className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          </button>
        </p>
      </div>
    </div>
  )
}
