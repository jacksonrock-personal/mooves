'use client'

// Screen 10: Settings / Profile Edit
// Mockup: mooves-screen10-settings.html
// Profile edits are inline and auto-save. Log out and delete are confirmed
// via bottom sheets. No sub-navigation.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { firebaseAuth } from '@/lib/firebase/client'
import { initPostHog, posthog } from '@/lib/posthog'
import BottomNav from '@/components/ui/BottomNav'
import Toast from '@/components/ui/Toast'
import ProfileCard from './ProfileCard'
import AreaControl from './AreaControl'
import NotificationSettings from './NotificationSettings'
import AvailabilitySettings from './AvailabilitySettings'
import { syncTimezone } from '@/lib/timezone'
import InterestPicker from '@/components/discover/InterestPicker'
import LogoutSheet from './LogoutSheet'
import DeleteSheet from './DeleteSheet'

interface Me {
  phone: string
  displayName: string | null
  avatarUrl: string | null
  areaZip: string | null
  hideFromMatches: boolean
  fofMoovesEnabled: boolean
  friendSuggestable: boolean
  areaCity: string | null
  areaState: string | null
  interests: string[]
  // Phase 22 — timezone is shown read-only; the other two drive the nudge.
  timezone: string | null
  weekRitualDay: number
  weekPushEnabled: boolean
}

export default function SettingsScreen() {
  const router = useRouter()

  const [me, setMe] = useState<Me | null>(null)
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [photoActionOpen, setPhotoActionOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const libraryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      initPostHog()
      posthog.capture('settings_viewed')

      const [profile, token] = await Promise.all([
        fetch('/api/users/me').then(r => r.json()) as Promise<{
          phone: string
          displayName: string | null
          avatarUrl: string | null
          areaZip: string | null
          hideFromMatches?: boolean
          fofMoovesEnabled?: boolean
          friendSuggestable?: boolean
          areaCity: string | null
          areaState: string | null
          interests: string[]
          timezone: string | null
          weekRitualDay: number
          weekPushEnabled: boolean
        }>,
        fetch('/api/auth/supabase-token').then(r => r.json()) as Promise<{
          token: string | null
          userId?: string
        }>,
      ])
      if (cancelled) return

      setMe({
        phone: profile.phone,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        areaZip: profile.areaZip,
        hideFromMatches: profile.hideFromMatches ?? false,
        fofMoovesEnabled: profile.fofMoovesEnabled ?? true,
        friendSuggestable: profile.friendSuggestable ?? true,
        areaCity: profile.areaCity,
        areaState: profile.areaState,
        interests: profile.interests ?? [],
        timezone: profile.timezone ?? null,
        weekRitualDay: profile.weekRitualDay ?? 1,
        weekPushEnabled: profile.weekPushEnabled ?? true,
      })
      setSupabaseToken(token.token)
      setUserId(token.userId ?? null)

      // Phase 22 — Settings is a second app-open surface, so the zone is
      // refreshed here too. Fire and forget; nothing on this screen waits on it.
      void syncTimezone(profile.timezone ?? null)
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleNameSave(name: string) {
    const previous = me
    setMe(prev => (prev ? { ...prev, displayName: name } : prev))
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('settings_name_updated')
    } catch {
      setMe(previous)
      setToastMessage("Couldn't update name, try again.")
    }
  }

  // 24.0 wall 4. Optimistic, rolled back on failure — a switch that silently
  // fails to save is worse than one that says so, because the user believes
  // they are hidden when they are not.
  async function handleSuggestableChange(next: boolean) {
    const previous = me
    setMe(prev => (prev ? { ...prev, friendSuggestable: next } : prev))
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendSuggestable: next }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('settings_friend_suggestable', { enabled: next })
    } catch {
      setMe(previous)
      setToastMessage("Couldn't save that, try again.")
    }
  }

  async function handleFofChange(next: boolean) {
    const previous = me
    setMe(prev => (prev ? { ...prev, fofMoovesEnabled: next } : prev))
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fofMoovesEnabled: next }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('settings_fof_mooves', { enabled: next })
    } catch {
      setMe(previous)
      setToastMessage("Couldn't save that, try again.")
    }
  }

  async function handleHideFromMatchesChange(next: boolean) {
    const previous = me
    setMe(prev => (prev ? { ...prev, hideFromMatches: next } : prev))
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideFromMatches: next }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('settings_hide_from_matches', { hidden: next })
    } catch {
      setMe(previous)
      setToastMessage("Couldn't save that, try again.")
    }
  }

  async function handleInterestsChange(next: string[]) {
    const previous = me
    setMe(prev => (prev ? { ...prev, interests: next } : prev))
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: next }),
      })
      if (!res.ok) throw new Error('save failed')
      posthog.capture('settings_interests_updated')
    } catch {
      setMe(previous)
      setToastMessage("Couldn't update interests, try again.")
    }
  }

  async function uploadPhoto(file: File, uid: string, token: string): Promise<string> {
    const supabase = createClient(token)
    const ext = file.type.includes('png') ? 'png' : 'jpg'
    const path = `${uid}/avatar.${ext}`
    const { error } = await supabase.storage
      .from('Avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const {
      data: { publicUrl },
    } = supabase.storage.from('Avatars').getPublicUrl(path)
    return publicUrl
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file || !supabaseToken || !userId || busy) return

    setBusy(true)
    const previous = me
    try {
      const url = await uploadPhoto(file, userId, supabaseToken)
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: url }),
      })
      if (!res.ok) throw new Error('save failed')
      // Cache-bust: the Storage path is stable across re-uploads (upsert).
      setMe(prev => (prev ? { ...prev, avatarUrl: `${url}?t=${Date.now()}` } : prev))
      posthog.capture('settings_photo_updated')
    } catch {
      setMe(previous)
      setToastMessage("Couldn't update photo, try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRemovePhoto() {
    setPhotoActionOpen(false)
    if (busy) return
    setBusy(true)
    const previous = me
    setMe(prev => (prev ? { ...prev, avatarUrl: null } : prev))
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: null }),
      })
      if (!res.ok) throw new Error('save failed')
      // Best-effort remove the underlying file.
      if (supabaseToken && userId) {
        const supabase = createClient(supabaseToken)
        await supabase.storage
          .from('Avatars')
          .remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`])
      }
      posthog.capture('settings_photo_removed')
    } catch {
      setMe(previous)
      setToastMessage("Couldn't update photo, try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    posthog.capture('settings_logout_confirmed')
    setLogoutOpen(false)
    try {
      await firebaseAuth.signOut()
    } catch {
      // ignore — clearing the server cookie is what matters
    }
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/auth')
  }

  async function handleDelete() {
    posthog.capture('settings_delete_confirmed')
    setBusy(true)
    try {
      const res = await fetch('/api/users/me', { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      try {
        await firebaseAuth.signOut()
      } catch {
        // ignore
      }
      router.replace('/')
    } catch {
      setBusy(false)
      setDeleteOpen(false)
      setToastMessage('Something went wrong, try again.')
    }
  }

  const loaded = me !== null

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg">
      {/* R14 — lockup removed, "Settings" moves up into the space it left. */}
      <header className="bg-white px-5 [--safe-pt-base:0.875rem] safe-area-pt pb-3.5 border-b border-[#E8E4F5] shrink-0">
        <h1 className="font-display font-extrabold text-[24px] text-ink-900 tracking-tight">
          Settings
        </h1>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-[calc(var(--nav-h)+22px+env(safe-area-inset-bottom))]">
        {loaded && (
          <>
            <ProfileCard
              displayName={me.displayName}
              phone={me.phone}
              avatarUrl={me.avatarUrl}
              onNameSave={handleNameSave}
              onAvatarTap={() => setPhotoActionOpen(true)}
            />

            <div className="h-6" />

            <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500 px-5 mb-2">
              Discovery
            </h2>
            <AreaControl
              initialZip={me.areaZip}
              initialCity={me.areaCity}
              initialState={me.areaState}
            />

            <div className="h-3.5" />

            <div className="bg-white border border-[#E8E4F5] rounded-[20px] p-4 mx-4">
              <div className="font-sans font-bold text-[15px] text-ink-900">Your interests</div>
              <div className="font-sans text-[13px] text-ink-500 mt-0.5 mb-3">
                Pick what you want to see in Discover.
              </div>
              <InterestPicker selected={me.interests} onChange={handleInterestsChange} />
            </div>

            <div className="h-3.5" />

            {/* R29 - one hop out, and the description ends on the thing people
                will actually worry about. "Does this show strangers when I'm
                free?" is the first question anyone asks, and the answer is no:
                greens never leave the friend graph, only Mooves can be opened,
                and only one at a time by the person who made them.

                It lives under Discovery with the other reach controls rather
                than under Notifications, because it changes what is in the feed
                and not what buzzes. */}
            <div className="bg-white border border-[#E8E4F5] rounded-[20px] p-4 mx-4 flex items-start gap-3">
              <span className="flex-1">
                <span className="block font-sans font-bold text-[15px] text-ink-900">
                  Mooves from friends of friends
                </span>
                <span className="block font-sans text-[13px] text-ink-500 mt-1 leading-[1.45]">
                  Mooves your friends&apos; friends chose to open up. You always see which friend
                  connects you, and they never see when you&apos;re free.
                </span>
              </span>
              <button
                onClick={() => void handleFofChange(!me.fofMoovesEnabled)}
                role="switch"
                aria-checked={me.fofMoovesEnabled}
                aria-label="Mooves from friends of friends"
                className={`shrink-0 w-[46px] h-[28px] rounded-full relative transition-colors ${
                  me.fofMoovesEnabled ? 'bg-green-500' : 'bg-grey-300'
                }`}
              >
                <span
                  className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all ${
                    me.fofMoovesEnabled ? 'left-[21px]' : 'left-[3px]'
                  }`}
                />
              </button>
            </div>

            <div className="h-3.5" />

            {/* R31 - the opt-out, and the WORDING is the design.
                Settings already has "Suggest me for things" (24.0), which
                governs the "would probably go" lines on Discover cards. These
                are different promises about different objects sitting in one
                list, so one is about THINGS and one is about being a FRIEND.
                Anything shorter collapses them.

                It governs both paths including co-attendance: a flag that
                quietly stops protecting you the moment you attend something is
                a trap, not a setting. */}
            <div className="bg-white border border-[#E8E4F5] rounded-[20px] p-4 mx-4 flex items-start gap-3">
              <span className="flex-1">
                <span className="block font-sans font-bold text-[15px] text-ink-900">
                  Suggest me as a friend
                </span>
                <span className="block font-sans text-[13px] text-ink-500 mt-1 leading-[1.45]">
                  Friends of your friends can see you as someone they might know, with the friends
                  you have in common. They still have to ask, and you decide.
                </span>
              </span>
              <button
                onClick={() => void handleSuggestableChange(!me.friendSuggestable)}
                role="switch"
                aria-checked={me.friendSuggestable}
                aria-label="Suggest me as a friend"
                className={`shrink-0 w-[46px] h-[28px] rounded-full relative transition-colors ${
                  me.friendSuggestable ? 'bg-green-500' : 'bg-grey-300'
                }`}
              >
                <span
                  className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all ${
                    me.friendSuggestable ? 'left-[21px]' : 'left-[3px]'
                  }`}
                />
              </button>
            </div>

            <div className="h-3.5" />

            {/* 24.0, wall 4 — the switch that makes the computed signal
                defensible. One tap and the user disappears from every "would
                probably go" line, everywhere, immediately.

                The description names the constraint rather than reassuring:
                friends cannot see it unless you are ALREADY free, because green
                overlap is the confidence floor. A guess is never made about
                someone who has declared nothing. */}
            <div className="bg-white border border-[#E8E4F5] rounded-[20px] p-4 mx-4 flex items-start gap-3">
              <span className="flex-1">
                <span className="block font-sans font-bold text-[15px] text-ink-900">
                  Suggest me for things
                </span>
                <span className="block font-sans text-[13px] text-ink-500 mt-1 leading-[1.45]">
                  When you&apos;re free and something nearby fits, your friends can see you&apos;d
                  probably go. They can&apos;t see it unless you&apos;re already free.
                </span>
              </span>
              <button
                onClick={() => void handleHideFromMatchesChange(!me.hideFromMatches)}
                role="switch"
                aria-checked={!me.hideFromMatches}
                aria-label="Suggest me for things"
                className={`shrink-0 w-[46px] h-[28px] rounded-full relative transition-colors ${
                  me.hideFromMatches ? 'bg-grey-300' : 'bg-green-500'
                }`}
              >
                <span
                  className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all ${
                    me.hideFromMatches ? 'left-[3px]' : 'left-[21px]'
                  }`}
                />
              </button>
            </div>

            {/* Not a control. The thing that did NOT change, stated next to the
                thing that did — which is what keeps the 24.0 amendment honest
                rather than quietly expanded. */}
            <div className="bg-white border border-[#E8E4F5] rounded-[20px] p-4 mx-4 mt-3.5">
              <span className="block font-sans font-bold text-[15px] text-ink-900">
                Sponsors never see you
              </span>
              <span className="block font-sans text-[13px] text-ink-500 mt-1 leading-[1.45]">
                They get counts, never names. That hasn&apos;t changed and it won&apos;t.
              </span>
            </div>

            <div className="h-3.5" />

            <button
              onClick={() => {
                posthog.capture('settings_loop_opened')
                router.push('/onboarding/loop?replay=1')
              }}
              className="flex items-center justify-between w-[calc(100%-2rem)] mx-4 bg-white border border-[#E8E4F5] rounded-[20px] p-4 text-left"
            >
              <span>
                <span className="block font-sans font-bold text-[15px] text-ink-900">The Mooves Loop</span>
                <span className="block font-sans text-[13px] text-ink-500 mt-0.5">
                  A quick refresher on how Mooves works.
                </span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BDB5D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <div className="h-6" />

            <AvailabilitySettings
              timezone={me.timezone}
              weekRitualDay={me.weekRitualDay}
              weekPushEnabled={me.weekPushEnabled}
            />

            <div className="h-6" />

            <NotificationSettings />

            <div className="h-6" />

            <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500 px-5 mb-2">
              Account
            </h2>

            <div className="flex justify-center px-5 py-1.5">
              <button
                onClick={() => {
                  posthog.capture('settings_logout_initiated')
                  setLogoutOpen(true)
                }}
                className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-purple-tint text-mooves-purple font-sans font-semibold text-[15px]"
              >
                Log out
              </button>
            </div>

            <div className="flex justify-center px-5 py-1.5">
              <button
                onClick={() => {
                  posthog.capture('settings_delete_initiated')
                  setDeleteOpen(true)
                }}
                className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-[#FFF0F2] text-[#E8405A] font-sans font-semibold text-[15px]"
              >
                Delete account
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav />

      {/* Hidden file inputs for the photo action sheet */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Photo action sheet (iOS-style) */}
      {photoActionOpen && (
        <>
          <div
            className="fixed inset-0 bg-text-primary/50 z-40"
            onClick={() => setPhotoActionOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 px-2 [--safe-pb-base:2.75rem] flex flex-col gap-2 safe-area-pb">
            <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl divide-y divide-[#E8E4F5]">
              <button
                onClick={() => {
                  setPhotoActionOpen(false)
                  cameraInputRef.current?.click()
                }}
                className="w-full py-4 font-sans text-[17px] font-medium text-mooves-purple"
              >
                Take a photo
              </button>
              <button
                onClick={() => {
                  setPhotoActionOpen(false)
                  libraryInputRef.current?.click()
                }}
                className="w-full py-4 font-sans text-[17px] font-medium text-mooves-purple"
              >
                Choose from library
              </button>
              {me?.avatarUrl && (
                <button
                  onClick={() => void handleRemovePhoto()}
                  className="w-full py-4 font-sans text-[17px] font-medium text-[#E8405A]"
                >
                  Remove photo
                </button>
              )}
            </div>
            <button
              onClick={() => setPhotoActionOpen(false)}
              className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-surface-bg/95 backdrop-blur-xl font-sans text-[17px] font-bold text-text-primary"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      <LogoutSheet
        open={logoutOpen}
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutOpen(false)}
      />
      <DeleteSheet
        open={deleteOpen}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  )
}
