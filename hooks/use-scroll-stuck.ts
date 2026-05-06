"use client"

import { useEffect, useState } from "react"

/**
 * Whether `sentinel` has scrolled above the top edge of `root`.
 *
 * - `root: HTMLElement` — nested scrollport (e.g. `overflow-y-auto` column).
 * - `root: null` — viewport / document scroll (`IntersectionObserver` default).
 * - `root: undefined` — do not observe (parent scroll root not mounted yet).
 */
export function useStickyBandPinned(
  root: HTMLElement | null | undefined,
  sentinel: HTMLElement | null,
): boolean {
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!sentinel || root === undefined) {
      setPinned(false)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setPinned(!entry.isIntersecting)
      },
      { root: root ?? null, rootMargin: "0px", threshold: 0 },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [root, sentinel])

  return pinned
}
