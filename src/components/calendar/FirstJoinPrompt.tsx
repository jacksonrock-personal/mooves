'use client'

// R35 — "Put your Mooves on your calendar?"
//
// Asked once per account, ever, right after a join. The server decides and
// spends it in one conditional write (POST /api/users/me/calendar/prompt), so
// this file never has to remember anything across sessions. Set up opens
// Calendar sync; Not now simply closes, and nothing asks again.

import { useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'
import CalendarSyncSheet from './CalendarSyncSheet'
import { BodyPortal, CalendarIcon } from './parts'

/** Session-level short circuit, so a spent prompt costs one request, not one per join. */
let spent = false
let inFlight = false

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

async function ask(): Promise<{ show: boolean; retry: boolean }> {
  const res = await fetch('/api/users/me/calendar/prompt', { method: 'POST' })
  if (!res.ok) return { show: false, retry: false }
  const data = (await res.json()) as { show?: boolean; retry?: boolean }
  return { show: data.show === true, retry: data.retry === true }
}

/**
 * Call right after an "I'm in". Resolves true when the prompt should open now,
 * at which point the server has already marked it shown.
 *
 * The join it follows is optimistic, so the first ask waits a beat for the
 * join's own request to land; the server answers `retry` while it has not, and
 * one more try covers a slow network. A join that never lands never spends it.
 */
export async function maybeCalendarPrompt(): Promise<boolean> {
  if (spent || inFlight) return false
  inFlight = true
  try {
    await wait(700)
    let answer = await ask()
    if (answer.retry) {
      await wait(1800)
      answer = await ask()
    }
    if (!answer.retry) spent = true
    return answer.show
  } catch {
    return false
  } finally {
    inFlight = false
  }
}

export default function FirstJoinPrompt({ onClose }: { onClose: () => void }) {
  const [syncing, setSyncing] = useState(false)

  if (syncing) return <CalendarSyncSheet source="prompt" onClose={onClose} />

  return (
    <BodyPortal>
      <Sheet open onClose={onClose} className="px-5 pb-[30px]">
        <div className="w-[46px] h-[46px] rounded-[14px] bg-purple-100 text-purple-700 flex items-center justify-center mb-3.5">
          <CalendarIcon size={24} />
        </div>
        <h2 className="font-display font-extrabold text-[19px] leading-tight tracking-tight text-ink-900 mb-1.5">
          Put your Mooves on your calendar?
        </h2>
        <p className="font-sans text-[13.5px] leading-[1.55] text-ink-500 mb-5">
          Every Moove you start or join shows up next to everything else, and moves with it if the plan changes.
        </p>
        <button
          onClick={() => {
            posthog.capture('calendar_prompt_setup')
            setSyncing(true)
          }}
          className="w-full py-3.5 rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)]"
        >
          Set up
        </button>
        <button
          onClick={onClose}
          className="block w-full mt-2 py-3 font-sans text-[14px] font-semibold text-ink-500"
        >
          Not now
        </button>
      </Sheet>
    </BodyPortal>
  )
}
