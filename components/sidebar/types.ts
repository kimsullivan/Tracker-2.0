import type { TabType } from "@/components/dashboard"
import type { Match } from "@/components/content/matches/types"
import type { AccountId } from "@/hooks/use-account-state"

export interface SidebarProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  selectedProject: string | null
  onSelectProject: (project: string | null) => void
  selectedProjectsForMultiSelect?: string[]
  onSelectProjectsForMultiSelect?: (projects: string[]) => void
  counts: {
    matches: number
    tracker: number
    applications: number
    awards: number
  }
  allProjectsCounts?: {
    matches: number
    tracker: number
    applications: number
    awards: number
  }
  showTrackerNotification?: boolean
  isDebugMode?: boolean
  plusOneOpacity?: number
  plusOneScale?: number
  plusOneValue?: number
  showAnimatedToast?: boolean
  savedMatchTitle?: string
  onToastUndo?: () => void
  onToastGoToTracker?: () => void
  onToastComplete?: () => void
  onToastShowPlusOne?: (opacity: number, scale: number) => void
  showPinnedSidebar: boolean
  setShowPinnedSidebar: (show: boolean) => void
  currentAccount?: AccountId
  onAccountChange?: (account: AccountId) => void
  onViewGrantDetails?: (grant: Match) => void
  searchModalOpen?: boolean
  onSearchModalOpenChange?: (open: boolean) => void
}
