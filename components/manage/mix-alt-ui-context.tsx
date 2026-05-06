import type { ReactNode } from "react"
import { createContext, useContext } from "react"

export type MixAltUiContextValue = {
  upcomingThresholdDays: number
  snoozedIssueIds: ReadonlySet<string>
}

const MixAltUiContext = createContext<MixAltUiContextValue | null>(null)

export function MixAltUiProvider({
  children,
  upcomingThresholdDays,
  snoozedIssueIds,
}: {
  children: ReactNode
  upcomingThresholdDays: number
  snoozedIssueIds: ReadonlySet<string>
}) {
  const value: MixAltUiContextValue = { upcomingThresholdDays, snoozedIssueIds }
  return <MixAltUiContext.Provider value={value}>{children}</MixAltUiContext.Provider>
}

export function useMixAltUi(): MixAltUiContextValue | null {
  return useContext(MixAltUiContext)
}
