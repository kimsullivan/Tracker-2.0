"use client"

import { useEffect, useState } from "react"

/** Local persistence for sidebar UI (prototype — not account-scoped). */
export function useAccountCachedState<T>(key: string, initial: T) {
  const storageKey = `traver-sidebar:${key}`
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw == null) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* ignore quota / private mode */
    }
  }, [storageKey, state])

  return [state, setState] as const
}
