'use client'

// Phase 19.1 — the live "adding everyone here" screen: one QR held up to a room,
// with the roster filling underneath it.
//
// No green anywhere in this phase. Green means availability, and nothing here is
// availability, so the confirmation and success states are purple.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { posthog } from '@/lib/posthog'
import { ROUNDUP_CAP, type RoundupMember, type RoundupSessionData } from '@/lib/roundup'
import { useWakeLock } from '@/lib/useWakeLock'
import Avatar from '@/components/ui/Avatar'
import QrCode from '@/components/ui/QrCode'

interface RoundupSessionProps {
  session: RoundupSessionData
  onClosed: (addedCount: number) => void
}

export default function RoundupSession({ session, onClosed }: RoundupSessionProps) {
  const [members, setMembers] = useState<RoundupMember[]>(session.members)
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const mountedRef = useRef(true)

  const isFull = members.length >= ROUNDUP_CAP
  const joinedCount = Math.max(members.length - 1, 0) // everyone but the host

  // Screen stays awake while the code is up. Brightness is untouchable on the
  // web, so this is the whole of what the spec's "dim bar" question can buy.
  useWakeLock(!isFull)

  const refreshRoster = useCallback(async () => {
    try {
      const res = await fetch('/api/roundups')
      if (!res.ok) return
      const data = (await res.json()) as { session: RoundupSessionData | null }
      if (mountedRef.current && data.session) setMembers(data.session.members)
    } catch {
      // transient — realtime or the next event will catch us up
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let channel: RealtimeChannel | null = null

    async function subscribe() {
      const tokenRes = (await fetch('/api/auth/supabase-token').then(r => r.json())) as {
        token: string | null
      }
      if (!mountedRef.current || !tokenRes.token) return

      const supabase = createClient(tokenRes.token)
      channel = supabase
        .channel(`roundup-${session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'roundup_members',
            filter: `roundup_id=eq.${session.id}`,
          },
          () => void refreshRoster(),
        )
        .subscribe()
    }

    void subscribe()
    posthog.capture('roundup_qr_shown')

    // Realtime can drop on a locked phone in a bar. A slow poll is the safety
    // net so the roster is never silently stale while the host holds it up.
    const poll = setInterval(() => void refreshRoster(), 15000)

    return () => {
      mountedRef.current = false
      clearInterval(poll)
      if (channel) void channel.unsubscribe()
    }
  }, [session.id, refreshRoster])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(session.url)
      setCopied(true)
      setTimeout(() => mountedRef.current && setCopied(false), 1800)
    } catch {
      // clipboard denied — the code on screen is still the primary path
    }
  }

  async function handleClose() {
    if (closing) return
    setClosing(true)
    try {
      const res = await fetch('/api/roundups/close', { method: 'POST' })
      const data = (await res.json()) as { addedCount?: number }
      posthog.capture('roundup_closed', { added: data.addedCount ?? joinedCount })
      onClosed(data.addedCount ?? joinedCount)
    } catch {
      setClosing(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3.5 pt-3.5 pb-24 flex flex-col gap-2.5">
        {isFull ? (
          <div className="bg-card-white border border-[#E8E4F5] rounded-[20px] px-5 py-6 text-center">
            <div className="w-[52px] h-[52px] mx-auto mb-3.5 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C5CDB"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="font-display font-extrabold text-[18px] text-text-primary tracking-tight mb-1.5">
              That&apos;s {ROUNDUP_CAP} people
            </h2>
            <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
              This one is full, so the code has stopped working. Tap Done to finish up, then start
              another if you need to.
            </p>
          </div>
        ) : (
          <div className="bg-card-white border border-[#E8E4F5] rounded-[20px] px-3.5 pt-3.5 pb-3.5">
            <div className="flex flex-col items-center">
              <QrCode value={session.url} size={150} label="Code to join" />
              <p className="font-sans text-[12.5px] text-text-secondary text-center mt-2.5 leading-snug">
                Point their cameras at this code.
              </p>
            </div>
            <button
              onClick={() => void handleCopy()}
              className="w-full mt-2.5 flex items-center gap-2 bg-surface-bg border border-[#E8E4F5] rounded-2xl px-3 py-2.5 text-left"
            >
              <span className="flex-1 min-w-0 font-sans text-[12.5px] font-semibold text-text-primary truncate">
                {session.url.replace(/^https:\/\//, '')}
              </span>
              <span className="shrink-0 flex items-center gap-1.5 font-sans text-[12.5px] font-bold text-mooves-purple">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copied ? 'Copied' : 'Copy'}
              </span>
            </button>
          </div>
        )}

        <div className="bg-card-white border border-[#E8E4F5] rounded-[20px] px-3.5 py-3.5">
          <div className="flex items-baseline justify-between px-1 pb-2">
            <span className="font-display font-extrabold text-[15px] text-text-primary tracking-tight">
              {joinedCount === 0 ? 'Nobody yet' : `${joinedCount} joined`}
            </span>
            <span className="font-sans text-[11.5px] font-semibold text-text-secondary">
              {isFull ? 'Full' : `Room for ${ROUNDUP_CAP - members.length} more`}
            </span>
          </div>

          {joinedCount === 0 ? (
            <div className="text-center px-4 pt-3 pb-1.5">
              <div className="flex gap-1.5 justify-center mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-status-grey animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-status-grey animate-pulse [animation-delay:180ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-status-grey animate-pulse [animation-delay:360ms]" />
              </div>
              <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                They&apos;ll show up here as they scan.
              </p>
            </div>
          ) : (
            <ul>
              {members.map((m, i) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-3 px-1 py-2.5 ${
                    i > 0 ? 'border-t border-grey-100' : ''
                  } ${m.isHost ? 'opacity-75' : ''}`}
                >
                  <Avatar src={m.avatarUrl} name={m.displayName} size={34} />
                  <span className="flex-1 min-w-0 font-sans text-[14px] font-semibold text-text-primary truncate">
                    {m.isHost ? 'You' : (m.displayName ?? 'Someone')}
                  </span>
                  {m.isHost && (
                    <span className="shrink-0 font-sans text-[10.5px] font-bold uppercase tracking-[0.06em] text-text-secondary bg-surface-bg border border-[#E8E4F5] px-1.5 py-[3px] rounded-md">
                      Host
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isFull && (
          <p className="font-sans text-[11.5px] text-text-secondary text-center leading-relaxed px-2">
            This stops working in 24 hours, or when you tap Done.
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card-white border-t border-[#E8E4F5] px-4 pt-3 [--safe-pb-base:1.25rem] safe-area-pb">
        <button
          onClick={() => void handleClose()}
          disabled={closing}
          className="w-full py-[15px] rounded-2xl bg-mooves-purple text-white font-display font-extrabold text-[15.5px] tracking-tight shadow-[0_6px_18px_rgba(124,92,219,0.3)] disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </>
  )
}
