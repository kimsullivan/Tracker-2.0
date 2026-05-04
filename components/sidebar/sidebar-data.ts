import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Calendar,
  CheckSquare,
  CircleDollarSign,
  EyeOff,
  FileText,
  LayoutDashboard,
  ListChecks,
  Table2,
  Users,
} from "lucide-react"

export const ENABLE_PROJECT_FOLDERS = false

// Sample data for search modal - recently viewed
export const recentlyViewedData = [
  {
    name: "100 Black Men Of Madison Inc",
    ein: "391803848",
    location: "Madison, WI",
    types: ["Funder", "Recipient"],
  },
]

// Sample opportunities data
export const opportunitiesData = [
  { name: "Thz Fo Farm Scholarship Fund", organization: "Hawai'i Community Foundation" },
  { name: "Sigma/Doris Bloch Research Award", organization: "Sigma Theta Tau Intl Fo For Nursing" },
  { name: "Alpha Eta Collaborative Research Grant", organization: "Sigma Theta Tau Intl Fo For Nursing" },
  { name: "Western Institute of Nursing Research Grant", organization: "Sigma Theta Tau Intl Fo For Nursing" },
  { name: "Foundation for Food & Agriculture Research", organization: "Foundation for Food & Agriculture Research" },
  { name: "Sustainable Agriculture Research Grant", organization: "USDA Foundation" },
  { name: "Community Development Block Grant", organization: "Department of Housing" },
  { name: "Environmental Protection Fund Grant", organization: "EPA Foundation" },
  { name: "Youth Education Initiative Grant", organization: "Education Foundation" },
  { name: "Healthcare Access Fund", organization: "Health Foundation" },
  { name: "Arts & Culture Grant Program", organization: "Arts Council" },
  { name: "Digital Literacy Initiative", organization: "Technology Foundation" },
  { name: "Mental Health Services Grant", organization: "Wellness Foundation" },
  { name: "Disaster Relief Fund", organization: "Emergency Response Foundation" },
  { name: "Affordable Housing Development", organization: "Housing Trust" },
]

// Sample 990 reports data
export const reports990Data = [
  {
    name: "F O H Inc.",
    ein: "061549144",
    location: "New Haven, CT",
    types: ["Funder", "Recipient"],
  },
  {
    name: "International F O P Association Inc.",
    ein: "592918100",
    location: "North Kansas City, MO",
    types: ["Funder", "Recipient"],
  },
  {
    name: "Reese Fam Charitable Fo II",
    ein: "464316861",
    location: "Vero Beach, FL",
    types: ["Funder"],
  },
  {
    name: "American Association of Obstetricians and Gynecologists Fo",
    ein: "386042799",
    location: "Forest Hill, MD",
    types: ["Funder", "Recipient"],
  },
]

// Project folder structure
export const projectFoldersData = [
  {
    id: "elayne-andreoli",
    name: "Elayne Andreoli",
    projects: [
      { id: "community-support", name: "Community Support", owner: "Elayne Andreoli", organization: "Alici" },
      { id: "dock-ellis", name: "Dock Ellis", owner: "Elayne Andreoli", organization: "Dock Ellis" },
      { id: "made", name: "M.A.D.E.", owner: "Elayne Andreoli", organization: "M.A.D.E." },
      { id: "museum", name: "Museum", owner: "Elayne Andreoli", organization: "Town of EH" },
      { id: "no-project-name", name: "No Project Name", owner: "Elayne Andreoli", organization: "Town of EH" },
    ],
  },
  {
    id: "victoria-ebright",
    name: "Victoria Ebright",
    projects: [
      { id: "camp-compassion", name: "Camp Compassion", owner: "Victoria Ebright", organization: "The Cove Center for Gri..." },
      { id: "eh-playground", name: "EH Playground", owner: "Victoria Ebright", organization: "Town of EH" },
      { id: "family-programs", name: "Family Programs", owner: "Victoria Ebright", organization: "The Cove Center for Gri..." },
    ],
  },
]

// Top-level projects (not in folders)
export const topLevelProjectsData = [
  { id: "all", name: "All Projects" },
  { id: "unassigned", name: "No project" },
  { id: "alpfa", name: "ALPFA", owner: "Eileen Vander Leun", organization: "ALPFA" },
  { id: "anne-springs", name: "Anne Springs Close Greenway Bridge Program", owner: "Karen Durkin", organization: "Anne Springs Close Greenway..." },
  { id: "general-operating", name: "General Operating & Start Up", owner: "Alison Christians", organization: "SOAR" },
]

export type GrantLifecycleNavItem = {
  id: string
  label: string
  icon: LucideIcon
  count: number
  showNotification?: boolean
  hasNew?: boolean
  hasTimeline?: boolean
  dataTour?: string
}

export function createGrantLifecycleItems(
  counts: { tracker: number; matches: number; applications: number; awards: number },
  showTrackerNotification: boolean,
): GrantLifecycleNavItem[] {
  return [
    {
      id: "tracker",
      label: "Tracker",
      icon: Table2,
      count: counts.tracker,
      showNotification: showTrackerNotification,
      dataTour: "tracker-tab",
    },
    {
      id: "matches",
      label: "Matches",
      icon: ListChecks,
      count: counts.matches,
      hasNew: counts.matches > 8,
      hasTimeline: true,
      dataTour: "matches-tab",
    },
    {
      id: "awards",
      label: "Awards",
      icon: CircleDollarSign,
      count: counts.awards,
      hasTimeline: true,
      dataTour: "awards-tab",
    },
  ]
}

export const matchesSubItemsData: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "peers", label: "Peers", icon: Users },
  { id: "hidden", label: "Hidden from all", icon: EyeOff },
]

export const enterpriseToolsItemsData: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "hq-dashboard", label: "HQ Dashboard", icon: LayoutDashboard },
  { id: "hq-approvals", label: "HQ Approvals", icon: CheckSquare },
]

export const managementToolsItemsData: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "tasks", label: "Task", icon: CheckSquare },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "documents", label: "Documents", icon: FileText },
]
