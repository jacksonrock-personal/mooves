// Phase 21 — Comments on a Moove.
//
// The amendment to "no in-app messaging, ever" is bounded by four walls, and the
// constraint is on WHO and FOR HOW LONG, not on how much you can say. Inside a
// room this small and this short-lived, the text can breathe — hence 500 rather
// than a terse cap.

export interface PlanComment {
  id: string
  authorId: string
  authorName: string | null
  authorAvatar: string | null
  body: string
  createdAt: string
  editedAt: string | null
}

export const COMMENT_MAX = 500

/**
 * The counter stays hidden until you are near the end.
 *
 * It counts DOWN, never up: "20 left" can only ever mean you are running out of
 * room, where a number counting up doubles as a score for how much you wrote.
 */
export const COMMENT_COUNTER_AT = 50

/** Comment pushes are capped at one per Moove per recipient per hour. */
export const COMMENT_PUSH_COOLDOWN_SECONDS = 3600

/** "2h" · "Thu" · "Aug 2" — same shape as the rest of the feed's timestamps. */
export function commentTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  const mins = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return then.toLocaleDateString('en-US', { weekday: 'short' })
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
