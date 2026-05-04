import type { Match } from "./types"

/** Prototype stub — Lookback passes a large filter object; real matching is not wired here. */
export function getFilteredMatches(
  _projectId: string | null,
  _sortLabel: string,
  _filters: Record<string, unknown>,
  _excluded: Set<string>,
): Match[] {
  return []
}
