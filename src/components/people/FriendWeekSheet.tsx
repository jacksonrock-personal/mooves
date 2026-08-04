'use client'

// R25 — a friend's week, in one view.
//
// Opened from two doors that land on the same sheet: a tile in the rail, and a
// row in the Friends list. Mockup: mooves-r25-friend-week.html (v3, approved).
//
// THE LAYOUT IS THE STRIP: columns are days, rows are parts. It won over the
// 7×3 grid on one argument — it is short enough that the whole week, the
// headline and the button clear the screen without a scroller, so the sheet
// hugs its content and the list you came from stays visible behind it.
//
// TWO WEIGHTS OF ONE COLOUR. A slot he planned is a green outline on a faint
// green fill; the slot happening RIGHT NOW is a solid green bar. Green could
// not go on being the thing that says "live" once planned slots were green
// too, so the difference is weight, not hue. Exactly one bar in a week can be
// solid.
//
// A part that does not exist on a weekday (there is no weekday morning, see
// partsForWeekday) is ABSENT, not empty: nothing is drawn at all. "He has no
// Monday morning" and "there is no such thing as a Monday morning" are
// different statements and the grid has to say which one it means.

import { useEffect, useMemo, useState } from 'react'
import { posthog } from '@/lib/posthog'
import Avatar from '@/components/ui/Avatar'
import Sheet from '@/components/ui/Sheet'
import CowIllustration from '@/components/ui/CowIllustration'
import {
  SLOT_LABEL,
  SLOT_WINDOW,
  isSlotPast,
  partsForWeekday,
  toLocalDateStr,
  type SlotPart,
} from '@/lib/availability'
import type { FriendWeek } from '@/app/api/friends/[friendId]/week/route'

/**
 * The three ROWS, top to bottom. The middle row holds `day` on a weekday and
 * `afternoon` at the weekend — one row, two parts, because a fourth row would
 * be blank five days out of seven. Jackson's call, and it is why the row label
 * is spelled out in full: "Day" is the only thing naming that part.
 */
const ROWS: readonly (readonly SlotPart[])[] = [
  ['morning'],
  ['day', 'afternoon'],
  ['evening'],
] as const
const ROW_LABEL = ['Morning', 'Day', 'Evening'] as const

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** 'YYYY-MM-DD' → a local Date at midnight. Never `new Date(str)`, which is UTC. */
function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface FriendWeekSheetProps {
  /** null closes the sheet. Passing an id opens it and starts the fetch. */
  friendId: string | null
  /** Shown while the fetch is in flight, so the sheet never opens blank. */
  fallbackName?: string | null
  fallbackAvatar?: string | null
  onClose: () => void
}

export default function FriendWeekSheet({
  friendId,
  fallbackName = null,
  fallbackAvatar = null,
  onClose,
}: FriendWeekSheetProps) {
  const [week, setWeek] = useState<FriendWeek | null>(null)
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!friendId) return
    let cancelled = false

    setWeek(null)
    setDenied(false)
    setLoading(true)
    posthog.capture('friend_week_opened')

    void fetch(`/api/friends/${friendId}/week`)
      .then(async r => {
        if (cancelled) return
        // 404 is the deliberate answer for "scoped away from you" as well as
        // "no such friend". The sheet says the same thing either way, which is
        // the point — see the route.
        if (!r.ok) {
          setDenied(true)
          return
        }
        setWeek((await r.json()) as FriendWeek)
      })
      .catch(() => {
        if (!cancelled) setDenied(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [friendId])

  // Fixed for the life of the open sheet: a `now` that moves under a render
  // would let the "happening right now" bar jump on an unrelated re-render.
  const now = useMemo(() => new Date(), [friendId])

  const days = useMemo(() => {
    if (!week) return []
    const start = parseDateStr(week.weekStart)
    const set = new Set(week.slots.map(s => `${s.date}|${s.part}`))

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      const dateStr = toLocalDateStr(date)
      const offered = partsForWeekday(date.getDay())

      const cells = ROWS.map(row => {
        const part = row.find(p => offered.includes(p))
        if (!part) return null // absent on this weekday, draw nothing
        return {
          part,
          on: set.has(`${dateStr}|${part}`),
          past: isSlotPast(date, part, now),
        }
      })

      return { date, dateStr, cells, isToday: dateStr === toLocalDateStr(now) }
    })
  }, [week, now])

  /**
   * The headline, which is where most taps end. Order matters: a live green
   * outranks a planned slot, because "he is free right now" is a different and
   * better answer than "he is free on Thursday".
   */
  const headline = useMemo(() => {
    if (!week) return null
    if (week.isGreen) return { k: 'Right now', v: 'Free now', muted: false }

    for (const day of days) {
      for (const cell of day.cells) {
        if (!cell || !cell.on || cell.past) continue
        const dayName = day.isToday ? 'Today' : DAY_LABEL[day.date.getDay()]
        const from = SLOT_WINDOW[cell.part].start
        const hour = from > 12 ? from - 12 : from
        return {
          k: 'Next free',
          v: `${dayName}, ${SLOT_LABEL[cell.part].toLowerCase()} from ${hour}`,
          muted: false,
        }
      }
    }
    return { k: 'Next free', v: 'Nothing left this week', muted: true }
  }, [week, days])

  const name = week?.displayName ?? fallbackName
  const hasAnything = week ? week.slots.length > 0 : false
  const range = week
    ? `${MONTH[parseDateStr(week.weekStart).getMonth()]} ${parseDateStr(week.weekStart).getDate()} – ` +
      `${MONTH[parseDateStr(week.weekEnd).getMonth()]} ${parseDateStr(week.weekEnd).getDate()}`
    : ''

  function handleText() {
    if (!week?.phone) return
    posthog.capture('friend_week_sms_opened')
    window.location.href = `sms:${week.phone}`
  }

  return (
    <Sheet open={friendId !== null} onClose={onClose} className="px-4 pb-5">
      <div className="flex items-center gap-3">
        <Avatar
          src={week?.avatarUrl ?? fallbackAvatar}
          name={name}
          size={50}
          className={week?.isGreen ? '' : 'grayscale opacity-[0.55]'}
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-[19px] text-ink-900 tracking-tight truncate">
            {name ?? 'Friend'}
          </p>
          <p className="font-sans text-[12.5px] text-ink-500 mt-0.5">
            {week ? range : loading ? 'Loading their week…' : ''}
          </p>
        </div>
        {week?.isGreen && (
          <span className="shrink-0 font-sans text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-green-700 bg-green-100 rounded-full px-2.5 py-1.5">
            Free now
          </span>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-[3px] border-purple-100 border-t-purple-500 animate-spin" />
        </div>
      )}

      {denied && !loading && (
        <div className="text-center px-6 pt-7 pb-2">
          <CowIllustration size={62} className="opacity-90 mx-auto" />
          <h3 className="font-display font-extrabold text-[17px] text-ink-900 mt-2.5 mb-1.5">
            No week to show.
          </h3>
          <p className="font-sans text-[13px] text-ink-500 leading-relaxed">
            You&apos;ll see it here if they set one.
          </p>
        </div>
      )}

      {week && !loading && (
        <>
          {headline && (
            <div className="mt-3.5 bg-white border-[1.5px] border-[#E8E4F5] rounded-2xl px-3.5 py-3">
              <p className="font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-500">
                {headline.k}
              </p>
              <p
                className={`font-display font-extrabold text-[17px] tracking-tight mt-1 ${
                  headline.muted ? 'text-grey-300' : 'text-ink-900'
                }`}
              >
                {headline.v}
              </p>
            </div>
          )}

          {hasAnything ? (
            <div className="flex gap-1.5 mt-4">
              {/* The row labels. 56px is measured: "Morning" is the widest and
                  needs 50 of it, and anything narrower wraps. */}
              <div className="flex flex-col gap-[5px] pt-[19px] w-[56px] shrink-0">
                {ROW_LABEL.map(l => (
                  <span
                    key={l}
                    className="h-[30px] flex items-center font-sans text-[9.5px] font-extrabold uppercase tracking-[0.04em] text-ink-500 whitespace-nowrap"
                  >
                    {l}
                  </span>
                ))}
              </div>

              {days.map(day => (
                <div
                  key={day.dateStr}
                  className={`flex-1 min-w-0 flex flex-col items-center gap-[5px] ${
                    day.cells.every(c => !c || c.past) ? 'opacity-[0.42]' : ''
                  }`}
                >
                  <span
                    className={`font-sans text-[10px] font-extrabold uppercase tracking-[0.03em] ${
                      day.isToday ? 'text-purple-700' : 'text-ink-500'
                    }`}
                  >
                    {DAY_LABEL[day.date.getDay()]}
                  </span>
                  {day.cells.map((cell, ri) => {
                    if (!cell) {
                      // Absent, not empty. Holds the row's height and nothing else.
                      return <span key={ri} className="w-full h-[30px]" />
                    }
                    // Solid = happening now. Exactly one bar in a week can be,
                    // and only when the friend is actually green.
                    const live = cell.on && week.isGreen && day.isToday && !cell.past
                    return (
                      <span
                        key={ri}
                        aria-label={`${DAY_LABEL[day.date.getDay()]} ${SLOT_LABEL[cell.part]}${
                          cell.on ? '' : ' — not free'
                        }`}
                        className={`w-full h-[30px] rounded-lg ${
                          live
                            ? 'bg-green-500 shadow-[0_0_0_3px_rgba(46,204,113,0.24)]'
                            : cell.on
                              ? 'border-[1.5px] border-green-500 bg-green-500/[0.13]'
                              : 'border-[1.5px] border-dashed border-[#E8E4F5]'
                        }`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center px-6 pt-6 pb-1">
              <CowIllustration size={62} className="opacity-90 mx-auto" />
              <h3 className="font-display font-extrabold text-[17px] text-ink-900 mt-2.5 mb-1.5">
                {name ? `${name.split(' ')[0]} hasn't set their week.` : 'No week set.'}
              </h3>
              <p className="font-sans text-[13px] text-ink-500 leading-relaxed">
                You&apos;ll see it here the week they do.
              </p>
            </div>
          )}
        </>
      )}

      {/* ONE CTA. "Plan something" was cut at mockup: with no way to pick WHICH
          slot you are planning around, it was the composer with a name attached,
          which the cow button already does from anywhere. */}
      {week?.phone && !loading && (
        <button
          onClick={handleText}
          className="w-full h-12 mt-4 rounded-[15px] bg-purple-500 text-white font-sans font-extrabold text-[14.5px]"
        >
          Text {name?.split(' ')[0] ?? 'them'}
        </button>
      )}
    </Sheet>
  )
}
