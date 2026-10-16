'use client'

// R35 — "Add to Google Calendar", the two steps.
//
// Subscribing by URL only exists on Google Calendar's WEBSITE. The phone app
// cannot add one, and calendar.google.com on a phone serves a mobile view
// without the option, so on a phone it only works after switching the browser
// to the desktop site. The tip says exactly that, and only on a touch device;
// on a computer it is just the link.
//
// The last line is the recorded limit, stated briefly: Google refreshes
// subscribed calendars on its own schedule, sometimes a day late.

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { posthog } from '@/lib/posthog'
import { GOOGLE_ADD_BY_URL } from '@/lib/calendar'
import { BodyPortal, CheckIcon, ExternalIcon, InfoIcon, SheetTitle, copyText, displayUrl } from './parts'

interface GoogleStepsSheetProps {
  /** The https feed URL. Google will not take webcal://. */
  url: string
  onClose: () => void
}

export default function GoogleStepsSheet({ url, onClose }: GoogleStepsSheetProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [onPhone, setOnPhone] = useState(false)

  useEffect(() => {
    try {
      setOnPhone(window.matchMedia('(pointer: coarse)').matches)
    } catch {
      setOnPhone(false)
    }
  }, [])

  async function handleCopy() {
    const ok = await copyText(url)
    setCopied(ok)
    setCopyFailed(!ok)
    if (ok) posthog.capture('calendar_link_copied', { where: 'google_steps' })
  }

  return (
    <BodyPortal>
      <Sheet open onClose={onClose} className="pb-[30px]">
        <SheetTitle onDone={onClose}>Add to Google Calendar</SheetTitle>

        <div className="px-5 pt-4">
          <div className="flex gap-3">
            <StepNumber n={1} />
            <div className="flex-1 min-w-0">
              <h3 className="font-sans text-[14.5px] font-bold leading-[1.35] text-ink-900 mb-2">
                Copy your calendar link
              </h3>
              <div className="flex items-center gap-2.5 px-3.5 py-3 bg-purple-50 border-[1.5px] border-[#E8E4F5] rounded-2xl">
                <code className="flex-1 min-w-0 font-sans text-[13px] text-ink-500 truncate">
                  {displayUrl(url)}
                </code>
                <button
                  onClick={() => void handleCopy()}
                  className={`shrink-0 inline-flex items-center gap-[5px] rounded-full px-3 py-[7px] font-sans text-[12.5px] font-bold ${
                    copied ? 'bg-purple-100 text-purple-700' : 'bg-purple-500 text-white'
                  }`}
                >
                  {copied && <CheckIcon />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {copyFailed && (
                <p className="font-sans text-[12.5px] text-ink-500 leading-normal mt-2">
                  Couldn&apos;t copy. Press and hold the link to copy it.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-[18px]">
            <StepNumber n={2} />
            <div className="flex-1 min-w-0">
              <h3 className="font-sans text-[14.5px] font-bold leading-[1.35] text-ink-900 mb-2">
                Paste it on Google&rsquo;s &ldquo;Add by URL&rdquo; page, then tap Add calendar
              </h3>
              <button
                onClick={() => window.open(GOOGLE_ADD_BY_URL, '_blank', 'noopener,noreferrer')}
                className="w-full py-[13px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[14.5px] tracking-tight flex items-center justify-center gap-[7px]"
              >
                Open Google Calendar
                <ExternalIcon />
              </button>
            </div>
          </div>
        </div>

        {onPhone && (
          <div className="flex gap-2.5 bg-purple-100 rounded-2xl px-[13px] py-3 mx-5 mt-[18px]">
            <InfoIcon />
            <p className="font-sans text-[12.5px] leading-normal font-medium text-purple-700">
              <b className="font-bold">On a phone,</b> tap <b className="font-bold">aA</b> in Safari, then{' '}
              <b className="font-bold">Request Desktop Website</b> first. Google&rsquo;s phone app can&rsquo;t add a
              calendar link.
            </p>
          </div>
        )}

        <p className="font-sans text-[12px] leading-normal text-ink-500 text-center px-[22px] pt-3">
          Google can take up to a day to pick up changes, so a new time may show up late.
        </p>
      </Sheet>
    </BodyPortal>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 shrink-0 mt-px rounded-full bg-purple-100 text-purple-700 font-display font-extrabold text-[12px] flex items-center justify-center">
      {n}
    </span>
  )
}
