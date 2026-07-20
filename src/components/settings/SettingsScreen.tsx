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
import Wordmark from '@/components/ui/Wordmark'
import ProfileCard from './ProfileCard'
import AreaControl from './AreaControl'
import InterestPicker from '@/components/discover/InterestPicker'
import LogoutSheet from './LogoutSheet'
import DeleteSheet from './DeleteSheet'

interface Me {
  phone: string
  displayName: string | null
  avatarUrl: string | null
  areaZip: string | null
  areaCity: string | null
  areaState: string | null
  interests: string[]
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
          areaCity: string | null
          areaState: string | null
          interests: string[]
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
        areaCity: profile.areaCity,
        areaState: profile.areaState,
        interests: profile.interests ?? [],
      })
      setSupabaseToken(token.token)
      setUserId(token.userId ?? null)
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
      {/* Header */}
      <header className="bg-white px-5 pt-14 pb-3.5 border-b border-[#E8E4F5] shrink-0">
        <div className="flex justify-center mb-3">
          <Wordmark withCow />
        </div>
        <h1 className="font-display font-extrabold text-[24px] text-ink-900 tracking-tight">
          Settings
        </h1>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-24">
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
          <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-11 flex flex-col gap-2 safe-area-pb">
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
