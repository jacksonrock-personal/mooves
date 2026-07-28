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
  /** R8 — likes. Zero renders NO number, only the outline heart. */
  likeCount: number
  likedByMe: boolean
  /**
   * Validated ids behind the @tokens in `body`.
   *
   * No longer roster-only. A mention may now name a friend who is not in the
   * Moove, provided that friend can already see it — see `TaggableFriend`.
   */
  mentions: string[]
}

/**
 * Someone you may tag who has NOT joined this Moove.
 *
 * The bounded amendment to wall 2. Wall 2 said you cannot pull someone into a
 * room they were never in, and that still holds for anyone who cannot see the
 * Moove: this list contains only your own friends who ALREADY have this Moove
 * in their feed, so a tag can never be the thing that reveals it. What it can
 * do is turn "visible in a feed they may not check today" into "somebody
 * actually asked me" — which is the entire point of the app.
 *
 * Derived server-side by `plan_taggable_friends`; the picker never assembles
 * this list itself.
 */
export interface TaggableFriend {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * R8 — split a comment body into plain runs and @mention runs, for rendering.
 *
 * Matching is by NAME against the roster we already hold, longest-first, so
 * "@Kate" cannot shadow "@Katherine". Names are matched rather than parsed as
 * a token because display names contain spaces; a naive /@\w+/ would highlight
 * "@Katherine" but drop the "Coates".
 *
 * Only names of people actually in the roster highlight. Typing "@nobody" is
 * just text, which is the same rule the server enforces on write.
 */
export function splitMentions(
  body: string,
  roster: { id: string; displayName: string | null }[],
): { text: string; mention: boolean }[] {
  const names = roster
    .map(r => r.displayName)
    .filter((n): n is string => !!n && n.length > 0)
    .sort((a, b) => b.length - a.length)

  if (names.length === 0) return [{ text: body, mention: false }]

  const out: { text: string; mention: boolean }[] = []
  let i = 0
  while (i < body.length) {
    if (body[i] === '@') {
      const hit = names.find(n => body.startsWith(n, i + 1))
      if (hit) {
        out.push({ text: `@${hit}`, mention: true })
        i += hit.length + 1
        continue
      }
    }
    const last = out[out.length - 1]
    if (last && !last.mention) last.text += body[i]
    else out.push({ text: body[i], mention: false })
    i += 1
  }
  return out
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
