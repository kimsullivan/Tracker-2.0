import { grants } from "@/lib/manage/data"

/** Prototype: return portfolio grants regardless of project filter. */
export function getFilteredGrants(_projectId: string | null) {
  return grants
}
