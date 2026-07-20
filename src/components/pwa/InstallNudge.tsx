'use client'

// Phase 15 Surface A — "Add to Home Screen" install nudge. Mounted app-wide but
// silent until a value moment (first join/blast) fires `mooves:value-moment`.
// iOS Safari gets a manual Share → Add-to-Home guide (no beforeinstallprompt
// exists there); Android/desktop get the native install prompt. Never shows when
// already installed; dismissible with a 7-day cooldown and a 3-show cap.
// Install-only — the push-permission ask is Surface B.

import { useEffect, useRef, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import CowMark from '@/components/ui/CowMark'
import { initPostHog, posthog } from '@/lib/posthog'
import { canShowNudge, incrementNudgeCount, isIOS, markNudgeDismissed, type BeforeInstallPromptEvent } from '@/lib/pwa'

function CowTile() {
  return (
    <div className="w-16 h-16 rounded-[19px] bg-[#F5F0ED] flex items-center justify-center mx-auto mb-3.5 overflow-hidden">
      <CowMark size={44} />
    </div>
  )
}

export default function InstallNudge() {
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const shownRef = useRef(false)

  useEffect(() => {
    initPostHog()

    function evaluate() {
      if (shownRef.current) return
      if (!canShowNudge(!!promptRef.current)) return
      shownRef.current = true
      const variant = isIOS() ? 'ios' : 'android'
      incrementNudgeCount()
      posthog.capture('install_nudge_shown', { platform: variant })
      setPlatform(variant)
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      evaluate() // value moment may already have happened this session
    }
    function onValueMoment() {
      evaluate()
    }
    function onInstalled() {
      posthog.capture('pwa_installed')
      shownRef.current = true
      setPlatform(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('mooves:value-moment', onValueMoment)
    window.addEventListener('appinstalled', onInstalled)
    evaluate() // handles a value moment reached in a prior session (iOS especially)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('mooves:value-moment', onValueMoment)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    markNudgeDismissed()
    posthog.capture('install_nudge_dismissed')
    setPlatform(null)
  }

  async function accept() {
    const deferred = promptRef.current
    posthog.capture('install_nudge_accepted', { platform: 'android' })
    setPlatform(null)
    if (!deferred) return
    promptRef.current = null // a prompt can only be used once
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch {
      // user dismissed the native prompt — appinstalled fires only on accept
    }
  }

  return (
    <Sheet open={platform !== null} onClose={dismiss} className="px-5 pb-7">
      {platform === 'ios' && (
        <div>
          <CowTile />
          <h2 className="font-display font-extrabold text-[20px] text-ink-900 text-center tracking-[-0.01em] leading-tight">
            Keep Mooves on your
            <br />
            home screen
          </h2>
          <p className="text-[13.5px] text-ink-500 text-center mt-1.5 leading-relaxed px-1.5">
            So you know the moment friends are free. Two taps, then the cow lives on your home screen.
          </p>
          <div className="flex flex-col gap-2.5 mt-5 mb-2">
            <div className="flex items-center gap-3 bg-purple-50 border border-[#E8E4F5] rounded-[14px] px-4 py-3.5">
              <span className="w-[22px] h-[22px] rounded-full bg-purple-500 text-white font-display font-extrabold text-[12px] flex items-center justify-center shrink-0">
                1
              </span>
              <span className="flex-1 text-[13.5px] text-ink-900 font-medium">
                Tap the <b className="font-bold">Share</b> button in your browser bar
              </span>
              <svg className="shrink-0 text-[#0A84FF]" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V4" />
                <path d="M8 8l4-4 4 4" />
                <path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
              </svg>
            </div>
            <div className="flex items-center gap-3 bg-purple-50 border border-[#E8E4F5] rounded-[14px] px-4 py-3.5">
              <span className="w-[22px] h-[22px] rounded-full bg-purple-500 text-white font-display font-extrabold text-[12px] flex items-center justify-center shrink-0">
                2
              </span>
              <span className="flex-1 text-[13.5px] text-ink-900 font-medium">
                Choose <b className="font-bold">Add to Home Screen</b>
              </span>
              <span className="w-[26px] h-[26px] rounded-[7px] border-2 border-[#0A84FF] text-[#0A84FF] text-[19px] flex items-center justify-center shrink-0 leading-none">
                +
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[12px] text-ink-500 mt-3.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B628A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            On iPhone, notifications need the app added first.
          </div>
          <button onClick={dismiss} className="w-full py-3 mt-3 text-ink-500 font-sans font-semibold text-[14px]">
            Maybe later
          </button>
        </div>
      )}

      {platform === 'android' && (
        <div>
          <CowTile />
          <h2 className="font-display font-extrabold text-[20px] text-ink-900 text-center tracking-[-0.01em] leading-tight">
            Add Mooves to your
            <br />
            home screen
          </h2>
          <p className="text-[13.5px] text-ink-500 text-center mt-1.5 leading-relaxed px-1.5">
            So you know the moment friends are free. It opens like an app, no store needed.
          </p>
          <button
            onClick={() => void accept()}
            className="w-full py-4 mt-6 rounded-full bg-purple-500 text-white font-sans font-bold text-[16px]"
          >
            Add to home screen
          </button>
          <button onClick={dismiss} className="w-full py-3 mt-1 text-ink-500 font-sans font-semibold text-[14px]">
            Not now
          </button>
        </div>
      )}
    </Sheet>
  )
}
