import { Heart, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { getProjectColorClassById } from "@/lib/project-utils"

interface ProjectIconProps {
  projectId: string | null
}

export function ProjectIcon({ projectId }: ProjectIconProps) {
  if (!projectId || projectId === "all") {
    return <Heart className="h-4 w-4 text-[#333]" strokeWidth={1.5} aria-hidden />
  }

  if (projectId === "unassigned") {
    return <Inbox className="h-4 w-4 text-[#333]" strokeWidth={1.5} aria-hidden />
  }

  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      <span
        className={cn(
          "inline-flex h-[10px] w-[10px] items-center justify-center rounded-full",
          getProjectColorClassById(projectId),
        )}
      />
    </span>
  )
}
