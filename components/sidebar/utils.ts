import { getProjectColorClass, projectDotColors } from "@/lib/project-utils"

export const projectColors = projectDotColors

export function getProjectColor(idx: number) {
  return getProjectColorClass(idx)
}
