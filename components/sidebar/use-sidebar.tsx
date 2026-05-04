"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { getProjectNameFromId } from "@/lib/project-utils"
import type { TabType } from "@/components/dashboard"
import type { Match } from "@/components/content/matches/types"
import { useAccountCachedState } from "@/hooks/use-account-cached-state"
import { getFilteredGrants } from "@/lib/grants-data"
import { getFilteredMatches } from "@/components/content/matches/use-matches"
import { sampleProjects } from "@/lib/projects-data"
import { isValidProjectId } from "@/lib/project-utils"
import { SidebarProps } from "./types"
import { 
  ENABLE_PROJECT_FOLDERS, 
  recentlyViewedData, 
  opportunitiesData, 
  reports990Data,
  projectFoldersData,
  topLevelProjectsData,
  createGrantLifecycleItems,
  matchesSubItemsData,
  enterpriseToolsItemsData,
  managementToolsItemsData
} from "./sidebar-data"


export function useSidebar({
  activeTab,
  onTabChange,
  selectedProject,
  onSelectProject,
  selectedProjectsForMultiSelect = [],
  onSelectProjectsForMultiSelect = () => {},
  counts,
  allProjectsCounts,
  showTrackerNotification = false,
  isDebugMode = false,
  plusOneOpacity = 0,
  plusOneScale = 1,
  plusOneValue = 1,
  showAnimatedToast = false,
  savedMatchTitle = "",
  onToastUndo = () => {},
  onToastGoToTracker = () => {},
  onToastComplete = () => {},
  onToastShowPlusOne = () => {},
  showPinnedSidebar,
  setShowPinnedSidebar,
  currentAccount = 'super-admin',
  onAccountChange,
  onViewGrantDetails,
  searchModalOpen,
  onSearchModalOpenChange,
}: SidebarProps) {
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [openFolders, setOpenFolders] = useState<string[]>([])
  const [internalSearchModalOpen, setInternalSearchModalOpen] = useState(false)
  
  // Use controlled state if provided, otherwise use internal state
  const isSearchModalOpen = searchModalOpen !== undefined ? searchModalOpen : internalSearchModalOpen
  const setIsSearchModalOpen = onSearchModalOpenChange || setInternalSearchModalOpen
  const [modalSearchQuery, setModalSearchQuery] = useState("")
  const [showAllOpportunities, setShowAllOpportunities] = useState(false)
  const [showAllReports, setShowAllReports] = useState(false)
  // Project accordion state - cached (account-scoped)
  const [expandedProjects, setExpandedProjects] = useAccountCachedState<string[]>("expandedProjects", ["all"])
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)
  
  // Project filter state - cached (account-scoped)
  const [projectFilter, setProjectFilter] = useAccountCachedState<'all' | 'sorted' | 'unsorted'>("projectFilter", 'all')
  
  // Projects collapse state - cached (account-scoped, default expanded)
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useAccountCachedState<boolean>("projectsCollapsed", false)
  
  // Lists collapse state - cached (account-scoped, default expanded)
  const [isListsCollapsed, setIsListsCollapsed] = useAccountCachedState<boolean>("listsCollapsed", false)

  // Core section collapse state - cached (account-scoped, default expanded)
  const [isCoreCollapsed, setIsCoreCollapsed] = useAccountCachedState<boolean>("coreCollapsed", false)
  
  // Tools section collapse state - cached (account-scoped, default expanded)
  const [isToolsCollapsed, setIsToolsCollapsed] = useAccountCachedState<boolean>("toolsCollapsed", false)
  
  // Advanced filter state
  const [selectedProjectType, setSelectedProjectType] = useState<string>("all")
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [leadSearchQuery, setLeadSearchQuery] = useState("")
  
  // Responsive state management - cached (account-scoped)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [manuallyCollapsed, setManuallyCollapsed] = useAccountCachedState<boolean>("sidebarCollapsed", false)
  
  // Screen size detection - auto-collapse threshold: 1024px (lg breakpoint)
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Combined manual and automatic collapse
  const collapsed = manuallyCollapsed || isSmallScreen;
  
  // Pinned projects state - cached (account-scoped)
  const [pinnedProjects, setPinnedProjects] = useAccountCachedState<string[]>("pinnedProjects", [])
  const [hoveredProjectInDropdown, setHoveredProjectInDropdown] = useState<string | null>(null)
  const [hidePinnedSidebarTimeout, setHidePinnedSidebarTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  
  // Projects flyout hover state
  const [isProjectsFlyoutOpen, setIsProjectsFlyoutOpen] = useState(false)
  
  // Projects expansion state - cached (account-scoped, default collapsed)
  const [isProjectsExpanded, setIsProjectsExpanded] = useAccountCachedState<boolean>("projectsExpanded", false)
  // Matches sub-items expansion state - cached (account-scoped, default expanded)
  const [isMatchesExpanded, setIsMatchesExpanded] = useAccountCachedState<boolean>("matchesExpanded", true)

  const handleMouseEnterPinnedSection = () => {
    if (hidePinnedSidebarTimeout) {
      clearTimeout(hidePinnedSidebarTimeout)
      setHidePinnedSidebarTimeout(null)
    }
    if (pinnedProjects.length > 0) {
      setShowPinnedSidebar(true)
    }
  }

  const handleMouseLeavePinnedSection = () => {
    const timeoutId = setTimeout(() => {
      setShowPinnedSidebar(false)
    }, 200) // 200ms delay
    setHidePinnedSidebarTimeout(timeoutId)
  }

  // Pin/unpin functionality
  const togglePinProject = useCallback((projectId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setPinnedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }, [setPinnedProjects])

  const isPinned = useCallback((projectId: string) => pinnedProjects.includes(projectId), [pinnedProjects])

  // Sample data for search modal - imported from sidebar-data.ts
  const recentlyViewed = recentlyViewedData
  const opportunities = opportunitiesData
  const reports990 = reports990Data

  // Helper function to map opportunity to Match object
  const mapOpportunityToMatch = useCallback((opportunity: { name: string; organization: string }): Match => {
    // Try to find matching grant in existing data
    const allMatches = getFilteredMatches(null, "Best Match", {
      givesToPeers: false,
      includePreviouslySaved: true,
      includePreviouslyHidden: true,
      confirmedDeadlines: false,
      earlyCareerResearchers: false,
      fundingUse: { projectProgram: false, educationOutreach: false },
      fieldOfWork: {
        basicHumanNeeds: false,
        foodAccessHunger: false,
        foodDeliveryDistribution: false,
        foodSecurity: false,
        nutritionHealthyEating: false,
        communityHealthEducation: false
      },
      locationOfProject: { unitedStates: false },
      locationOfResidency: { carterCountyTennessee: false },
      pastGiving: { orgWithProjectLocation: false, orgWithResidencyLocation: false },
      funderType: { associationSociety: false, private: false, federalGovernment: false },
      strictLocationPreferences: true
    }, new Set())
    
    // Map "Community Development Block Grant" to existing "Community Development Grant"
    if (opportunity.name === "Community Development Block Grant") {
      const existingMatch = allMatches.find(m => m.title === "Community Development Grant")
      if (existingMatch) return existingMatch
    }
    
    // For Patricia D. Klingenstein Grants, find the actual match with complete funder data
    if (opportunity.name === "Patricia D. Klingenstein Grants") {
      const existingMatch = allMatches.find(m => m.id === "patricia-d-klingenstein-grants" || m.title === "Patricia D. Klingenstein Grants")
      if (existingMatch) return existingMatch
    }
    
    // Check for other exact matches
    const existingMatch = allMatches.find(m => m.title === opportunity.name)
    if (existingMatch) return existingMatch
    
    // Create placeholder match if no existing data found
    return {
      id: `lookup-${opportunity.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: opportunity.name,
      organization: opportunity.organization,
      deadline: "TBD",
      amount: "Contact funder for details",
      matchScore: 85,
      projects: [],
      description: `For more information about ${opportunity.name}, please visit the funder's website or contact them directly.`,
      website: "https://example.com",
    }
  }, [])

  // Filter data based on search query
  const filteredOpportunities = modalSearchQuery 
    ? opportunities.filter(opp => 
        opp.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
        opp.organization.toLowerCase().includes(modalSearchQuery.toLowerCase())
      )
    : opportunities

  const filteredReports = modalSearchQuery
    ? reports990.filter(report =>
        report.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
        report.location.toLowerCase().includes(modalSearchQuery.toLowerCase())
      )
    : reports990

  // Show limited items unless "see more" is clicked or searching
  const displayedOpportunities = showAllOpportunities 
    ? (modalSearchQuery ? filteredOpportunities : opportunities)
    : (modalSearchQuery ? filteredOpportunities.slice(0, 3) : opportunities.slice(0, 3))

  const displayedReports = showAllReports
    ? (modalSearchQuery ? filteredReports : reports990)
    : (modalSearchQuery ? filteredReports.slice(0, 2) : reports990.slice(0, 2))

  const hasMoreOpportunities = modalSearchQuery 
    ? filteredOpportunities.length > 3 
    : opportunities.length > 3

  const hasMoreReports = modalSearchQuery
    ? filteredReports.length > 2
    : reports990.length > 2

  // Knowledge section - commented out for now, moved Documents to Management Tools
  // const knowledgeItems = [
  //   { id: "documents", label: "Documents", icon: ... },
  // ]

  const grantLifecycleItems = createGrantLifecycleItems(counts, showTrackerNotification)
  const matchesSubItems = matchesSubItemsData
  const enterpriseToolsItems = enterpriseToolsItemsData
  const managementToolsItems = managementToolsItemsData

  // Project data - imported from sidebar-data.ts
  const projectFolders = projectFoldersData
  const topLevelProjects = topLevelProjectsData

  // ---------------------------------------------------------------------------
  // Effective project lists (respecting ENABLE_PROJECT_FOLDERS flag)
  // ---------------------------------------------------------------------------

  const flatFolderProjects = projectFolders.flatMap(folder => folder.projects)

  // For rendering in dropdown (excluding the "all" item except where needed)
  const renderableTopLevelProjects = ENABLE_PROJECT_FOLDERS
    ? topLevelProjects
    : [...topLevelProjects, ...flatFolderProjects]

  // ---------------------------------------------------------------------------

  const sidebarProjects = useMemo(
    () => sampleProjects.filter((project) => isValidProjectId(project.id) && project.id !== "unassigned"),
    []
  )

  const allProjects = useMemo(
    () =>
      sidebarProjects
        .filter((project) => project.projectType === "matches-tracking")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({
          id: project.id,
          name: project.name,
          owner: project.owner,
          organization: project.organization,
        })),
    [sidebarProjects]
  )

  const trackingOnlyProjects = useMemo(
    () =>
      sidebarProjects
        .filter((project) => project.projectType === "tracking")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({
          id: project.id,
          name: project.name,
          owner: project.owner,
          organization: project.organization,
        })),
    [sidebarProjects]
  )

  const filteredProjects = useMemo(() => 
    allProjects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [allProjects, searchQuery]
  )

  // Get pinned project details - memoized
  const getPinnedProjectDetails = useMemo(() => {
    return pinnedProjects.map(projectId => {
      const project = allProjects.find(p => p.id === projectId)
      return project ? { ...project, id: projectId } : null
    }).filter(Boolean)
  }, [pinnedProjects, allProjects])

  // Helper to check if a folder has any visible projects after filtering
  const folderHasVisibleProjects = (folder: any) =>
    folder.projects.some((p: any) =>
      filteredProjects.find((fp) => fp.id === p.id)
    )

  // Helper to get visible projects for a folder
  const getVisibleProjectsForFolder = (folder: any) =>
    folder.projects.filter((p: any) =>
      filteredProjects.find((fp) => fp.id === p.id)
    )

  // Helper to get visible top-level projects
  const visibleTopLevelProjects = renderableTopLevelProjects.filter((p: any) =>
    filteredProjects.find((fp) => fp.id === p.id)
  )

  const getProjectName = (id: string | null) => {
    if (isDebugMode) return "No Project"
    if (!id || id === "all") return "All Projects"
    // Use centralized project utils for consistent naming
    return getProjectNameFromId(id)
  }


  const handleNewProject = () => {
    setIsProjectDialogOpen(true)
  }

  const handleProjectCreated = (projectId: string) => {
    // In a real app, you would fetch the new project details
    // For now, we'll just select the project
    onSelectProject(projectId)

    // Switch to the matches tab to show the new project
    onTabChange("matches")
  }
  
  // Only one project can be expanded at a time.
  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects(prev =>
      prev.includes(projectId)
        ? [] // Collapse if clicking the already-expanded project
        : [projectId] // Replace with only this project
    )
  }

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    )
  }

  const layoutConfig = {
    sections: []
  }

  // Helper function to check if a project has grants assigned
  const projectHasGrants = useCallback((projectId: string) => {
    const grants = getFilteredGrants(projectId)
    return grants.length > 0
  }, [])

  // Return all state and props
  return {
    // Original props passed through
    activeTab,
    onTabChange,
    selectedProject,
    onSelectProject,
    selectedProjectsForMultiSelect,
    onSelectProjectsForMultiSelect,
    counts,
    allProjectsCounts,
    showTrackerNotification,
    isDebugMode,
    plusOneOpacity,
    plusOneScale,
    plusOneValue,
    showAnimatedToast,
    savedMatchTitle,
    onToastUndo,
    onToastGoToTracker,
    onToastComplete,
    onToastShowPlusOne,
    showPinnedSidebar,
    setShowPinnedSidebar,
    currentAccount,
    onAccountChange,
    onViewGrantDetails,
    // Internal state
    isProjectDialogOpen, setIsProjectDialogOpen,
    searchQuery, setSearchQuery,
    openFolders, setOpenFolders,
    internalSearchModalOpen, setInternalSearchModalOpen,
    isSearchModalOpen, setIsSearchModalOpen,
    modalSearchQuery, setModalSearchQuery,
    showAllOpportunities, setShowAllOpportunities,
    showAllReports, setShowAllReports,
    expandedProjects, setExpandedProjects,
    toggleProjectExpansion,
    toggleFolder,
    isProjectDropdownOpen, setIsProjectDropdownOpen,
    projectFilter, setProjectFilter,
    isProjectsCollapsed, setIsProjectsCollapsed,
    isListsCollapsed, setIsListsCollapsed,
    isCoreCollapsed, setIsCoreCollapsed,
    isToolsCollapsed, setIsToolsCollapsed,
    selectedProjectType, setSelectedProjectType,
    selectedLeads, setSelectedLeads,
    leadSearchQuery, setLeadSearchQuery,
    isSmallScreen,
    manuallyCollapsed, setManuallyCollapsed,
    collapsed,
    pinnedProjects, setPinnedProjects,
    hoveredProjectInDropdown, setHoveredProjectInDropdown,
    hidePinnedSidebarTimeout, setHidePinnedSidebarTimeout,
    isProjectsFlyoutOpen, setIsProjectsFlyoutOpen,
    handleMouseEnterPinnedSection, handleMouseLeavePinnedSection,
    togglePinProject, isPinned,
    recentlyViewed, opportunities, reports990,
    mapOpportunityToMatch,
    filteredOpportunities, filteredReports,
    displayedOpportunities, displayedReports,
    hasMoreOpportunities, hasMoreReports,
    grantLifecycleItems, matchesSubItems, enterpriseToolsItems, managementToolsItems,
    projectFolders, topLevelProjects,
    flatFolderProjects, renderableTopLevelProjects,
    allProjects, filteredProjects,
    getPinnedProjectDetails,
    folderHasVisibleProjects,
    getVisibleProjectsForFolder,
    visibleTopLevelProjects,
    trackingOnlyProjects,
    layoutConfig,
    projectHasGrants,
    handleNewProject,
    handleProjectCreated,
    isProjectsExpanded, setIsProjectsExpanded,
    isMatchesExpanded, setIsMatchesExpanded
  }
}

export type SidebarState = ReturnType<typeof useSidebar>
