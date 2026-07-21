'use client'

import { useEffect, useState } from 'react'

// Measures the on-screen keyboard's height via the VisualViewport API and returns
// it in pixels (0 when no keyboard). On iOS Safari a `position: fixed; bottom: 0`
// element stays pinned to the layout viewport, so the keyboard covers it; feeding
// this value into a sheet's `bottomInset` lifts the sheet (and its CTA) above the
// keyboard. Only tracks while `active` (e.g. the sheet is open).
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (!active) {
      setInset(0)
      return
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return

    const update = () => {
      // Portion of the layout viewport hidden below the visual viewport = keyboard.
      const hidden = window.innerHeight - vv.height - vv.offsetTop
      setInset(hidden > 1 ? Math.round(hidden) : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return inset
}
