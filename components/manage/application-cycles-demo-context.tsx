"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { toast } from "sonner"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { grants } from "@/lib/manage/data"
import {
  findInProgressProposalTarget,
  patchAppCycleRow,
  seedAppCycles,
  formatSubmissionDateDisplay,
  type AppCycle,
} from "@/lib/manage/application-cycles"

export type ApplicationCyclesDemoContextValue = {
  cyclesByGrantId: Record<string, AppCycle[]>
  setCyclesForGrant: (grantId: string, u: SetStateAction<AppCycle[]>) => void
  /** Demo: record full proposal submission from My work without opening the grant. */
  recordProposalSubmissionFromQueue: (grantId: string, fileName: string, submissionDate: string) => boolean
}

const ApplicationCyclesDemoContext = createContext<ApplicationCyclesDemoContextValue | null>(null)

export function ApplicationCyclesDemoProvider({ children }: { children: ReactNode }) {
  const [cyclesByGrantId, setCyclesByGrantId] = useState<Record<string, AppCycle[]>>(() =>
    Object.fromEntries(grants.map((g) => [g.id, seedAppCycles(g.ownerId, g.id)])),
  )

  const setCyclesForGrant = useCallback((grantId: string, u: SetStateAction<AppCycle[]>) => {
    setCyclesByGrantId((prev) => {
      const g = grants.find((x) => x.id === grantId)
      const cur =
        prev[grantId] ??
        (g ? seedAppCycles(g.ownerId, g.id) : seedAppCycles(grants[0].ownerId, grants[0].id))
      const next = typeof u === "function" ? (u as (c: AppCycle[]) => AppCycle[])(cur) : u
      return { ...prev, [grantId]: next }
    })
  }, [])

  const recordProposalSubmissionFromQueue = useCallback(
    (grantId: string, fileName: string, submissionDate: string) => {
      let ok = false
      setCyclesByGrantId((prev) => {
        const g = grants.find((x) => x.id === grantId)
        if (!g) return prev
        const cycles = prev[grantId] ?? seedAppCycles(g.ownerId, g.id)
        const found = findInProgressProposalTarget(cycles)
        if (!found) return prev
        ok = true
        const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        const nextCycles = patchAppCycleRow(cycles, found.cycleId, found.rowId, {
          status: "submitted",
          submissionDate,
          lastUpdated: stamp,
        })
        return { ...prev, [grantId]: nextCycles }
      })
      return ok
    },
    [],
  )

  const value = useMemo(
    () => ({ cyclesByGrantId, setCyclesForGrant, recordProposalSubmissionFromQueue }),
    [cyclesByGrantId, setCyclesForGrant, recordProposalSubmissionFromQueue],
  )

  return <ApplicationCyclesDemoContext.Provider value={value}>{children}</ApplicationCyclesDemoContext.Provider>
}

export function useApplicationCyclesDemoOptional(): ApplicationCyclesDemoContextValue | null {
  return useContext(ApplicationCyclesDemoContext)
}

export function useApplicationCyclesForGrant(
  grantId: string,
  ownerId: string,
): { appCycles: AppCycle[]; setAppCycles: Dispatch<SetStateAction<AppCycle[]>> } {
  const ctx = useContext(ApplicationCyclesDemoContext)
  const [fallbackCycles, setFallbackCycles] = useState<AppCycle[]>(() => seedAppCycles(ownerId, grantId))

  useEffect(() => {
    if (ctx) return
    const g = grants.find((x) => x.id === grantId) || grants[0]
    setFallbackCycles(seedAppCycles(g.ownerId, g.id))
  }, [grantId, ownerId, ctx])

  const seedOwner = (grants.find((x) => x.id === grantId) || grants[0]).ownerId

  const setAppCycles = useCallback(
    (u: SetStateAction<AppCycle[]>) => {
      if (ctx) ctx.setCyclesForGrant(grantId, u)
      else setFallbackCycles(u)
    },
    [ctx, grantId],
  )

  const appCycles = ctx ? (ctx.cyclesByGrantId[grantId] ?? seedAppCycles(seedOwner, grantId)) : fallbackCycles

  return { appCycles, setAppCycles }
}

/** Shared dialog: enter a submission date + choose a file, then record the submission against the
 *  current in-progress full proposal for that grant. Used from My work (dropdown) and the
 *  grant Applications-tab "Due soon" banner. */
export function UploadApplicationDialog({
  open,
  onOpenChange,
  grantId,
  grantTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  grantId: string
  grantTitle: string
}) {
  const demo = useContext(ApplicationCyclesDemoContext)
  const [date, setDate] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setDate("")
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  function handleSubmit() {
    if (!demo) return
    const d = date.trim()
    if (!d) {
      toast.error("Enter a submission date")
      return
    }
    if (!fileName) {
      toast.error("Choose an application file")
      return
    }
    const ok = demo.recordProposalSubmissionFromQueue(grantId, fileName, d)
    if (!ok) {
      toast.error("Could not update the application row (demo).")
      return
    }
    toast.success("Submission recorded", {
      description: `${fileName} · ${formatSubmissionDateDisplay(d)}`,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="font-heading text-base">Upload proposal</DialogTitle>
          <DialogDescription className="text-[12px]">
            {grantTitle} — full proposal submission
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Submission date
            </div>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-[13px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Application file
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setFileName(f.name)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full justify-start gap-2 text-[13px] font-normal"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5 shrink-0" aria-hidden />
              {fileName ?? "Choose file (PDF or DOC)"}
            </Button>
          </div>
        </div>
        <DialogFooter className="gap-2 border-t border-border/60 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!date.trim() || !fileName}>
            Record submission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
