'use client'

// R31 — the two new sections at the top of the Friends panel.
//
// ONE component for both, because they are one state machine: accepting a
// request turns somebody into a friend, asking a suggestion turns it into
// "Asked", and both have to reconcile against the friend list underneath. Split
// across two components they would each hold half the truth and refetch each
// other's half.
//
// BOTH SECTIONS SIT ABOVE THE FRIEND LIST (Jackson, at mockup). The draft had
// suggestions below it, which is where somebody with sixty friends never
// scrolls — the feature would have shipped and never been seen.
//
// EACH SECTION IS ABSENT WHEN EMPTY. Not an empty state, not a placeholder. A
// "nobody to suggest yet" block sitting above your actual friends is permanent
// furniture explaining a feature that is not doing anything, and a user with
// neither should see exactly the People tab they see today.
//
// NO BADGE, NO COUNT, NO DOT — anywhere, including the tab that leads here.
// This is the release most tempted to break that rule and it is not decoration:
// it is why opening Mooves does not feel like a job. A waiting request is
// announced by one push, and after that by this section simply existing.

import { useCallback, useEffect, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import type { IncomingRequest } from '@/app/api/friend-requests/route'
import type { FriendSuggestion } from '@/app/api/friend-suggestions/route'

interface PeopleDiscoveryProps {
  /** Accepting someone makes them a friend, so the list below has to reload. */
  onFriendAdded: () => void
  onToast: (message: string) => void
}

/** "You both know Marcus, Dev and 2 others" — the named-bridges rule from R29. */
function mutualLine(names: string[], count: number): string | null {
  if (count === 0 || names.length === 0) return null
  if (count <= names.length) {
    if (names.length === 1) return `You both know ${names[0]}`
    if (names.length === 2) return `You both know ${names[0]} and ${names[1]}`
    return `You both know ${names[0]}, ${names[1]} and ${names[2]}`
  }
  const rest = count - names.length
  return `You both know ${names.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`
}

function Row({
  name,
  avatarUrl,
  why,
  children,
}: {
  name: string | null
  avatarUrl: string | null
  why: string | null
  children: React.ReactNode
}) {
  // FriendRow's geometry exactly — 40px avatar, 13px gap, 20px gutter, 15px
  // medium name, hairline underneath. A request and a friend are the same kind
  // of object in the same list and must not look like two different apps.
  return (
    <div className="flex items-center gap-[13px] px-5 py-3 bg-white border-b border-[#E8E4F5]">
      <Avatar src={avatarUrl} name={name} size={40} className="shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-sans text-[15px] font-medium text-text-primary truncate">
          {name ?? 'Someone'}
        </span>
        {why && (
          <span className="block font-sans text-[12px] text-ink-500 leading-[1.4] mt-0.5">
            {why}
          </span>
        )}
      </span>
      <span className="shrink-0 flex items-center gap-2">{children}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 px-5 pt-3.5 pb-2 bg-surface-bg">
      {children}
    </p>
  )
}

export default function PeopleDiscovery({ onFriendAdded, onToast }: PeopleDiscoveryProps) {
  const [requests, setRequests] = useState<IncomingRequest[]>([])
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([])
  const [asked, setAsked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        fetch('/api/friend-requests').then(res => (res.ok ? res.json() : null)),
        fetch('/api/friend-suggestions').then(res => (res.ok ? res.json() : null)),
      ])
      if (r) {
        setRequests((r as { requests: IncomingRequest[] }).requests ?? [])
        setAsked(new Set((r as { sentTo: string[] }).sentTo ?? []))
      }
      if (s) setSuggestions((s as { suggestions: FriendSuggestion[] }).suggestions ?? [])
    } catch {
      // Silent. Neither section is load-bearing for the People tab, and a
      // failed fetch must never be what stops your actual friends rendering.
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function respond(fromId: string, action: 'accept' | 'decline', name: string | null) {
    if (busy) return
    setBusy(fromId)
    // Optimistic: the row goes either way, and the decline in particular must
    // feel like nothing happened.
    setRequests(rs => rs.filter(r => r.fromId !== fromId))
    try {
      const res = await fetch(`/api/friend-requests/${fromId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('failed')
      posthog.capture(action === 'accept' ? 'friend_request_accepted' : 'friend_request_declined')
      if (action === 'accept') {
        onToast(`${name ?? 'They'} ${name ? 'is' : 'are'} now your friend.`)
        onFriendAdded()
      }
      // A decline says nothing to anyone, including you. No toast.
    } catch {
      onToast("Couldn't do that, try again.")
      void load()
    } finally {
      setBusy(null)
    }
  }

  async function ask(userId: string) {
    if (busy) return
    setBusy(userId)
    setAsked(prev => new Set(prev).add(userId))
    try {
      const res = await fetch(`/api/friend-requests/${userId}`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as { status: string; crossed?: boolean }
      posthog.capture('friend_request_sent')
      // They had already asked YOU. Both people have consented, so the server
      // made it a friendship rather than a second pending request.
      if (data.crossed) {
        onToast('You were both asking. You are friends now.')
        onFriendAdded()
        void load()
      }
    } catch {
      setAsked(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
      onToast("Couldn't do that, try again.")
    } finally {
      setBusy(null)
    }
  }

  const visibleSuggestions = suggestions.filter(s => !requests.some(r => r.fromId === s.id))

  if (requests.length === 0 && visibleSuggestions.length === 0) return null

  return (
    <>
      {requests.length > 0 && (
        <>
          <SectionLabel>Wants to be friends</SectionLabel>
          {requests.map(r => (
            <Row
              key={r.id}
              name={r.displayName}
              avatarUrl={r.avatarUrl}
              why={mutualLine(r.mutualNames, r.mutualCount)}
            >
              {/* Decline sits LEFT of Accept, quiet, so the destructive one is
                  not where the thumb lands by default. */}
              <button
                onClick={() => void respond(r.fromId, 'decline', r.displayName)}
                disabled={busy !== null}
                className="font-sans text-[13px] font-semibold text-ink-500 px-1 py-2 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                onClick={() => void respond(r.fromId, 'accept', r.displayName)}
                disabled={busy !== null}
                className="font-sans text-[13px] font-bold text-white bg-purple-500 rounded-full px-3.5 py-2 disabled:opacity-50"
              >
                Accept
              </button>
            </Row>
          ))}
        </>
      )}

      {visibleSuggestions.length > 0 && (
        <>
          <SectionLabel>People you might know</SectionLabel>
          {visibleSuggestions.map(s => {
            const sent = asked.has(s.id)
            const why = sent
              ? `Asked · they'll see it next time they open Mooves`
              : s.reason === 'coAttended' && s.coPlanTitle
                ? `You were both at ${s.coPlanTitle}`
                : mutualLine(s.mutualNames, s.mutualCount)
            return (
              <Row key={s.id} name={s.displayName} avatarUrl={s.avatarUrl} why={why}>
                {/* The row STAYS after you ask, greyed. Removing it on tap is
                    tidier and leaves you unsure it sent, and the one thing a
                    request must never be is ambiguous. */}
                <button
                  onClick={() => void ask(s.id)}
                  disabled={sent || busy !== null}
                  className={`font-sans text-[13px] rounded-full px-3.5 py-2 disabled:opacity-100 ${
                    sent
                      ? 'bg-grey-100 text-ink-500 font-semibold'
                      : 'bg-purple-500 text-white font-bold'
                  }`}
                >
                  {sent ? 'Asked' : 'Add'}
                </button>
              </Row>
            )
          })}
        </>
      )}
    </>
  )
}
