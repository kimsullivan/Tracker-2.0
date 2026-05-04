import { ChevronDown, ExternalLink, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectCreationForm } from "@/components/project-creation-form"
import { SidebarState } from "../use-sidebar"

interface SidebarDialogsProps {
  sidebarState: SidebarState
}

export function SidebarDialogs({ sidebarState }: SidebarDialogsProps) {
  const {
    isProjectDialogOpen,
    setIsProjectDialogOpen,
    handleProjectCreated,
    isSearchModalOpen,
    setIsSearchModalOpen,
    modalSearchQuery,
    setModalSearchQuery,
    recentlyViewed,
    displayedOpportunities,
    onViewGrantDetails,
    mapOpportunityToMatch,
    showAllOpportunities,
    hasMoreOpportunities,
    setShowAllOpportunities,
    filteredOpportunities,
    opportunities,
    displayedReports,
    showAllReports,
    hasMoreReports,
    setShowAllReports,
    filteredReports,
    reports990,
  } = sidebarState

  return (
    <>
      {/* Project Creation Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <ProjectCreationForm onClose={() => setIsProjectDialogOpen(false)} onSuccess={handleProjectCreated} />
        </DialogContent>
      </Dialog>

      {/* Search Modal */}
      <Dialog open={isSearchModalOpen} onOpenChange={(open) => {
        setIsSearchModalOpen(open)
        if (!open) setModalSearchQuery("")
      }}>
        <DialogContent className={cn(
          "max-w-2xl max-h-[80vh] overflow-y-auto",
          "!fixed !left-[50%] !top-[100px] !z-50 !translate-x-[-50%] !translate-y-0",
          "bg-background border shadow-lg rounded-lg p-0"
        )}>
          <div className="p-6">
            <DialogTitle className="mb-4">Lookup a funder or grant opportunity by name</DialogTitle>
            
            {/* Search Input */}
            <div className="flex border border-silver-300 rounded-md overflow-hidden">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-smoke-300" />
                <input
                  type="search"
                  placeholder="Search"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="lookup-dialog-search w-full h-9 pl-10 pr-4 border-none outline-none bg-white text-sblack text-sm placeholder:text-smoke-300 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-cancel-button]:hover:bg-smoke-100 [&::-webkit-search-cancel-button]:rounded [&::-webkit-search-cancel-button]:p-1"
                />
              </div>
              
              {/* Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2 border-l border-silver-300 bg-white hover:bg-smoke-50 text-twilight-350 text-sm flex items-center gap-2">
                    All
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="p-2 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="search-type" value="all" defaultChecked className="text-twilight-300" />
                      <span className="text-sm">Funders & Opportunities</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="search-type" value="funders" className="text-twilight-300" />
                      <span className="text-sm">Funders</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="search-type" value="recipients" className="text-twilight-300" />
                      <span className="text-sm">Recipients</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="search-type" value="all" className="text-twilight-300" />
                      <span className="text-sm">All</span>
                    </label>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Search Button */}
              <button className="px-4 py-2 bg-twilight-200 hover:bg-twilight-250 text-twilight-300 border-l border-silver-300 transition-colors">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-col">
            {/* Recently Viewed */}
            <SearchResultSection title="RECENTLY VIEWED">
              {recentlyViewed.map((item, index) => (
                <RecentlyViewedItem key={index} item={item} isLast={index === recentlyViewed.length - 1} />
              ))}
            </SearchResultSection>

            {/* Only show Opportunities and 990 Reports when searching */}
            {modalSearchQuery && (
              <>
                {/* Opportunities */}
                <SearchResultSection title="OPPORTUNITIES">
                  {displayedOpportunities.map((opportunity, index) => (
                    <OpportunityItem 
                      key={index} 
                      opportunity={opportunity} 
                      isLast={index === displayedOpportunities.length - 1}
                      onClick={() => {
                        if (onViewGrantDetails) {
                          const match = mapOpportunityToMatch(opportunity)
                          onViewGrantDetails(match)
                          setIsSearchModalOpen(false)
                        }
                      }}
                    />
                  ))}
                  {!showAllOpportunities && hasMoreOpportunities && (
                    <button 
                      onClick={() => setShowAllOpportunities(true)}
                      className="text-twilight-300 text-sm hover:text-twilight-350 transition-colors font-medium px-6 pb-3"
                    >
                      See {(modalSearchQuery ? filteredOpportunities.length : opportunities.length) - 3} more
                    </button>
                  )}
                </SearchResultSection>

                {/* 990 Reports */}
                <SearchResultSection title="990 REPORTS">
                  {displayedReports.map((report, index) => (
                    <ReportItem key={index} report={report} isLast={index === displayedReports.length - 1} />
                  ))}
                  {!showAllReports && hasMoreReports && (
                    <button 
                      onClick={() => setShowAllReports(true)}
                      className="text-twilight-300 text-sm hover:text-twilight-350 transition-colors font-medium px-6 pb-3"
                    >
                      See {(modalSearchQuery ? filteredReports.length : reports990.length) - 2} more
                    </button>
                  )}
                </SearchResultSection>
              </>
            )}

            {/* Add New Option */}
            {modalSearchQuery && (
              <div className="border-t border-silver-200 bg-azure-50 p-5 px-6 pb-3">
                <p className="text-sm text-smoke-300 mb-3">Don't see what you're looking for?</p>
                <button className="flex items-center gap-2 font-light text-azure-400 transition-colors hover:text-azure-300">
                  <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  Add "{modalSearchQuery}" as a New Funder or Opportunity
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper components
function SearchResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-silver-100 border-t border-b border-silver-300 text-smoke-250 text-xs tracking-wide font-medium py-2.5 px-5">
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}

function RecentlyViewedItem({ item, isLast }: { item: any; isLast: boolean }) {
  return (
    <div className={cn(
      "group w-full py-3 hover:bg-silver-100 transition-colors cursor-pointer",
      !isLast && "border-b border-silver-200"
    )}>
      <div className="flex items-center justify-between px-6">
        <div className="flex-1">
          <div className="font-medium text-sblack">{item.name}</div>
          <div className="text-sm text-smoke-300 flex items-center gap-2">
            <span>EIN: {item.ein} • {item.location}</span>
            <div className="flex gap-2">
              {item.types.map((type: string, typeIndex: number) => (
                <TypeBadge key={typeIndex} type={type} />
              ))}
            </div>
          </div>
        </div>
        <ExternalLink
          className="h-4 w-4 text-smoke-300 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </div>
  )
}

function OpportunityItem({ opportunity, isLast, onClick }: { opportunity: any; isLast: boolean; onClick: () => void }) {
  return (
    <div 
      className={cn(
        "group py-3 hover:bg-silver-100 transition-colors cursor-pointer",
        !isLast && "border-b border-silver-200"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-6">
        <div className="flex-1">
          <div className="font-medium text-sblack">{opportunity.name}</div>
          <div className="text-sm text-smoke-300">{opportunity.organization}</div>
        </div>
        <ExternalLink
          className="h-4 w-4 text-smoke-300 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </div>
  )
}

function ReportItem({ report, isLast }: { report: any; isLast: boolean }) {
  return (
    <div className={cn(
      "group w-full py-3 hover:bg-silver-100 transition-colors cursor-pointer",
      !isLast && "border-b border-silver-200"
    )}>
      <div className="flex items-center justify-between px-6">
        <div className="flex-1">
          <div className="font-medium text-sblack">{report.name}</div>
          <div className="text-sm text-smoke-300 flex items-center gap-2">
            <span>EIN: {report.ein} • {report.location}</span>
            <div className="flex gap-2">
              {report.types.map((type: string, typeIndex: number) => (
                <TypeBadge key={typeIndex} type={type} />
              ))}
            </div>
          </div>
        </div>
        <ExternalLink
          className="h-4 w-4 text-smoke-300 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      "px-2 py-0.5 text-xs font-semibold rounded border",
      type === "Funder" 
        ? "text-[#3A8FA1] bg-[#E1F1F4] border-[#BCE0E6]" 
        : "text-[#2E4DE0] bg-[#E9ECFC] border-[#D3D9F8]"
    )}>
      {type}
    </span>
  )
}
