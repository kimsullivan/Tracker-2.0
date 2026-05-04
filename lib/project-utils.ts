import { projectFoldersData, topLevelProjectsData } from "@/components/sidebar/sidebar-data"

const nameById = new Map<string, string>()

for (const p of topLevelProjectsData) {
  nameById.set(p.id, p.name)
}
for (const folder of projectFoldersData) {
  for (const p of folder.projects) {
    nameById.set(p.id, p.name)
  }
}

export const projectDotColors = [
  "bg-emerald-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-sky-400",
  "bg-violet-400",
]

export function isValidProjectId(id: string): boolean {
  if (!id || id === "all" || id === "unassigned") return false
  return nameById.has(id)
}

export function getProjectNameFromId(id: string): string {
  return nameById.get(id) ?? id
}

export function getProjectIndexFromId(id: string): number {
  const keys = [...nameById.keys()].filter((k) => k !== "all" && k !== "unassigned")
  const i = keys.indexOf(id)
  return i >= 0 ? i : 0
}

export function getProjectColorClass(idx: number): string {
  return projectDotColors[idx % projectDotColors.length] ?? "bg-slate-400"
}

export function getProjectColorClassById(id: string): string {
  return getProjectColorClass(getProjectIndexFromId(id))
}
