'use client'

// R35 — Calendar sync: every Moove you start or join, on your own calendar.
//
// One sheet, two states, decided by whether a feed link exists yet:
//   not set up → one line of explanation, Apple Calendar, Google Calendar
//   set up     → a purple "Synced" chip (green is reserved for availability),
//                the same two rows, Copy link, and a quiet red Reset link
//
// There is no separate "turn on" step. Tapping Apple or Google mints the link
// on the way through, so setting it up IS choosing where it goes.
//
// Reset stacks a native-style action sheet (MooveActionsSheet's shape) with the
// spec's copy verbatim, then mints a new link; the old one 404s from then on.

import { useCallback, useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'
import GoogleStepsSheet from './GoogleStepsSheet'
import { AppRow, AppTile, BodyPortal, CheckIcon, RowGroup, SheetTitle, copyText } from './parts'

export type CalendarSyncSource = 'settings' | 'add_sheet' | 'prompt'

interface Urls {
  url: string | null
  webcalUrl: string | null
}

interface CalendarSyncSheetProps {
  source: CalendarSyncSource
  onClose: () => void
  /** Lets Settings flip its Off/On without refetching. */
  onStatusChange?: (on: boolean) => void
}

type Load = 'loading' | 'error' | 'ready'

export default function CalendarSyncSheet({ source, onClose, onStatusChange }: CalendarSyncSheetProps) {
  const [load, setLoad] = useState<Load>('loading')
  const [urls, setUrls] = useState<Urls>({ url: null, webcalUrl: null })
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [google, setGoogle] = useState(false)

  const fetchUrls = useCallback(async () => {
    setLoad('loading')
    try {
      const res = await fetch('/api/users/me/calendar')
      if (!res.ok) throw new Error('load failed')
      const data = (await res.json()) as Urls
      setUrls({ url: data.url, webcalUrl: data.webcalUrl })
      setLoad('ready')
    } catch {
      setLoad('error')
    }
  }, [])

  useEffect(() => {
    posthog.capture('calendar_sync_opened', { source })
    void fetchUrls()
  }, [fetchUrls, source])

  const isOn = urls.url !== null

  /** The link, minting it first if this is the moment sync gets set up. */
  async function ensureUrls(provider: 'apple' | 'google'): Promise<Urls | null> {
    if (urls.url && urls.webcalUrl) return urls
    setWorking(true)
    setActionError(null)
    try {
      const res = await fetch('/api/users/me/calendar', { method: 'POST' })
      if (!res.ok) throw new Error('mint failed')
      const data = (await res.json()) as Urls
      if (!data.url || !data.webcalUrl) throw new Error('no url')
      setUrls(data)
      onStatusChange?.(true)
      posthog.capture('calendar_sync_enabled', { provider, source })
      return data
    } catch {
      setActionError("Couldn't set up calendar sync. Try again.")
      return null
    } finally {
      setWorking(false)
    }
  }

  async function handleApple() {
    const u = await ensureUrls('apple')
    // webcal:// hands the URL to the system's Subscribe dialog.
    if (u?.webcalUrl) window.location.href = u.webcalUrl
  }

  async function handleGoogle() {
    const u = await ensureUrls('google')
    if (u?.url) setGoogle(true)
  }

  async function handleCopy() {
    if (!urls.url) return
    const ok = await copyText(urls.url)
    if (!ok) {
      setActionError("Couldn't copy the link. Try again.")
      return
    }
    setActionError(null)
    setCopied(true)
    posthog.capture('calendar_link_copied', { where: 'sync' })
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function handleReset() {
    setConfirmReset(false)
    setWorking(true)
    setActionError(null)
    try {
      const res = await fetch('/api/users/me/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      })
      if (!res.ok) throw new Error('reset failed')
      const data = (await res.json()) as Urls
      setUrls(data)
      setCopied(false)
      posthog.capture('calendar_link_reset')
    } catch {
      setActionError("Couldn't reset the link. Try again.")
    } finally {
      setWorking(false)
    }
  }

  if (google && urls.url) {
    return <GoogleStepsSheet url={urls.url} onClose={onClose} />
  }

  const blurb =
    'Every Moove you start or join shows up on your calendar, and updates itself when plans change.'

  return (
    <BodyPortal>
      <Sheet open onClose={onClose} className="pb-[30px]">
        <SheetTitle onDone={onClose}>Calendar sync</SheetTitle>

        {load === 'loading' && (
          <p className="font-sans text-[13.5px] text-grey-300 px-5 pt-3 pb-6">Loading</p>
        )}

        {load === 'error' && (
          <button
            onClick={() => void fetchUrls()}
            className="font-sans text-[13.5px] font-semibold text-purple-500 px-5 pt-3 pb-6 text-left"
          >
            Couldn&apos;t load calendar sync. Try again
          </button>
        )}

        {load === 'ready' && (
          <>
            {isOn && (
              <span className="self-start inline-flex items-center gap-1.5 mx-5 mt-3 rounded-full bg-purple-100 pl-2 pr-2.5 py-[5px] font-sans text-[12px] font-bold text-purple-700">
                <CheckIcon />
                Synced
              </span>
            )}
            <p
              className={`font-sans text-[13.5px] leading-[1.55] text-ink-500 px-5 ${isOn ? 'pt-2' : 'pt-1.5'}`}
            >
              {blurb}
            </p>

            <RowGroup className="mt-4">
              <AppRow
                tile={<AppTile kind="apple" />}
                title="Apple Calendar"
                subtitle={isOn ? 'Add on another device' : 'Adds in one tap'}
                onClick={() => void handleApple()}
                disabled={working}
              />
              <AppRow
                tile={<AppTile kind="google" />}
                title="Google Calendar"
                subtitle="Two quick steps"
                onClick={() => void handleGoogle()}
                disabled={working}
              />
              {isOn && (
                <AppRow
                  tile={<AppTile kind="link" />}
                  title={copied ? 'Copied' : 'Copy link'}
                  subtitle="For Outlook or anything else"
                  onClick={() => void handleCopy()}
                  disabled={working}
                  chevron={false}
                />
              )}
            </RowGroup>

            {actionError && (
              <p className="font-sans text-[12.5px] text-red-500 text-center px-8 mt-3">{actionError}</p>
            )}

            {isOn ? (
              <>
                <button
                  onClick={() => setConfirmReset(true)}
                  disabled={working}
                  className="block mx-auto mt-[18px] font-sans text-[13.5px] font-semibold text-red-500 disabled:opacity-50"
                >
                  Reset link
                </button>
                <p className="font-sans text-[11.5px] leading-normal text-ink-500 text-center px-[30px] mt-1">
                  Anyone with your link can see your Mooves. Reset it if it ends up somewhere it shouldn&rsquo;t.
                </p>
              </>
            ) : (
              <p className="font-sans text-[11.5px] leading-normal text-ink-500 text-center px-[30px] mt-3.5">
                Only Mooves you&rsquo;re in. Nothing from your calendar comes back to Mooves.
              </p>
            )}
          </>
        )}
      </Sheet>

      {confirmReset && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/35 z-[60]"
            onClick={() => setConfirmReset(false)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[61] px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb"
            role="dialog"
            aria-modal="true"
          >
            <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl">
              <p className="font-sans text-[12.5px] font-medium leading-normal text-ink-500 text-center px-[22px] pt-3.5 pb-3 border-b border-[#E8E4F5]">
                Your old link stops working. You&rsquo;ll need to add the new one again.
              </p>
              <button
                onClick={() => void handleReset()}
                className="w-full py-4 font-sans text-[17px] font-medium text-red-500"
              >
                Reset link
              </button>
            </div>
            <button
              onClick={() => setConfirmReset(false)}
              className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl font-sans text-[17px] font-bold text-ink-900"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </BodyPortal>
  )
}
