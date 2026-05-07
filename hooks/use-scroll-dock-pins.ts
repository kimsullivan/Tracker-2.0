"use client"

import { useCallback, useLayoutEffect, useState } from "react"

export type ScrollDockPins = {
  /** Viewport geometry of the vertical scroll container (for `position: fixed` alignment). */
  dockRect: DOMRect | null
  /**
   * `scrollEl.clientWidth` — pair with `dockRect.left` for fixed toolbars.
   * `getBoundingClientRect().width` includes the vertical scrollbar gutter and can clip the right edge.
   */
  dockClientWidth: number | null
  pinToggle: boolean
  pinFilter: boolean
  pinHeader: boolean
}

/**
 * Deterministic “pinned” state for stacked toolbars inside `scrollEl`:
 * each sentinel has scrolled above the top edge of the scroll container’s visible rect.
 * Drives `position: fixed` + spacers so layout works without relying on `position: sticky`.
 */
export function useScrollDockPins(
  scrollEl: HTMLElement | null,
  enabled: boolean,
  sentinelToggle: HTMLElement | null,
  sentinelFilter: HTMLElement | null,
  sentinelHeader: HTMLElement | null,
): ScrollDockPins {
  const [pins, setPins] = useState<ScrollDockPins>({
    dockRect: null,
    dockClientWidth: null,
    pinToggle: false,
    pinFilter: false,
    pinHeader: false,
  })

  const measure = useCallback(() => {
    if (!enabled || !scrollEl) {
      setPins({
        dockRect: null,
        dockClientWidth: null,
        pinToggle: false,
        pinFilter: false,
        pinHeader: false,
      })
      return
    }
    const dock = scrollEl.getBoundingClientRect()

    /** Pinned once the sentinel has moved strictly above the scrollport top (not merely flush with it at scrollTop 0). */
    const pin = (sentinel: HTMLElement | null) =>
      sentinel !== null && sentinel.getBoundingClientRect().top < dock.top - 1

    setPins({
      dockRect: dock,
      dockClientWidth: scrollEl.clientWidth,
      pinToggle: pin(sentinelToggle),
      pinFilter: pin(sentinelFilter),
      pinHeader: pin(sentinelHeader),
    })
  }, [enabled, scrollEl, sentinelToggle, sentinelFilter, sentinelHeader])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useLayoutEffect(() => {
    if (!enabled || !scrollEl) return
    scrollEl.addEventListener("scroll", measure, { passive: true })
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, { passive: true })
    return () => {
      scrollEl.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure)
    }
  }, [enabled, scrollEl, measure])

  return pins
}
