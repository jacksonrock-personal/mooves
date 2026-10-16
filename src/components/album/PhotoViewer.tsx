'use client'

// R36 — full-screen photo viewer.
//
// Swipe sideways (or arrow keys) between photos; the dots stay faint. Under the
// photo: "{Name} · {when}" and the photo's comments, which are Moove comments
// exactly (hearts, roster-only @mentions, 500 cap) and last as long as the
// photo.
//
// "···" opens a native-style action sheet: Save, then Delete photo (your own)
// or Remove photo (the Moove's creator, on someone else's), then Cancel. A
// joiner looking at someone else's photo gets Save and Cancel only. Delete and
// Remove both confirm first.

import { useEffect, useRef, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { posthog } from '@/lib/posthog'
import { useKeyboardInset } from '@/lib/useKeyboardInset'
import { commentTime } from '@/lib/comments'
import { fetchPhotoFile, saveFile } from '@/lib/photoClient'
import type { AlbumPerson, AlbumPhoto } from '@/lib/photos'
import PhotoComments from './PhotoComments'

interface PhotoViewerProps {
  planId: string
  photos: AlbumPhoto[]
  index: number
  meId: string
  isCreator: boolean
  authorId: string
  roster: AlbumPerson[]
  onIndex: (i: number) => void
  onClose: () => void
  onRemoved: (photoId: string) => void
}

const SWIPE_PX = 50
const MAX_DOTS = 12

export default function PhotoViewer({
  planId,
  photos,
  index,
  meId,
  isCreator,
  authorId,
  roster,
  onIndex,
  onClose,
  onRemoved,
}: PhotoViewerProps) {
  const photo = photos[index]
  const [menu, setMenu] = useState<'list' | 'confirm' | null>(null)
  const [working, setWorking] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const fileRef = useRef<Promise<File> | null>(null)
  const touchX = useRef<number | null>(null)
  const keyboardInset = useKeyboardInset(true)

  const mine = photo?.uploaderId === meId
  const canRemove = !!photo && (mine || isCreator)
  const ownerName = photo ? (mine ? 'You' : (photo.uploaderName ?? 'Someone')) : ''

  function go(delta: number) {
    const next = index + delta
    if (next < 0 || next >= photos.length) return
    onIndex(next)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'Escape') {
        if (menu) setMenu(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // A photo that was removed out from under the viewer closes it.
  useEffect(() => {
    if (!photo) onClose()
  }, [photo, onClose])

  if (!photo) return null

  function openMenu() {
    setSaveFailed(false)
    // Prefetch now so Save can call navigator.share() inside the tap's
    // user-activation window — iOS refuses it after a network round trip.
    const p = fetchPhotoFile(photo.url, `mooves-${photo.id.slice(0, 8)}.jpg`)
    p.catch(() => {})
    fileRef.current = p
    setMenu('list')
  }

  async function handleSave() {
    try {
      const file = await (fileRef.current ??
        fetchPhotoFile(photo.url, `mooves-${photo.id.slice(0, 8)}.jpg`))
      const how = await saveFile(file)
      if (how !== 'cancelled') posthog.capture('album_photo_saved', { method: how })
      setMenu(null)
    } catch {
      setSaveFailed(true)
    }
  }

  async function handleRemove() {
    if (working) return
    setWorking(true)
    const byCreator = !mine
    try {
      const res = await fetch(`/api/plans/${planId}/photos/${photo.id}`, { method: 'DELETE' })
      if (res.ok) {
        posthog.capture(byCreator ? 'album_photo_removed_by_creator' : 'album_photo_deleted')
        setMenu(null)
        onRemoved(photo.id)
      }
    } catch {
      // stays open; the user can try again
    } finally {
      setWorking(false)
    }
  }

  const dots = photos.length > 1 && photos.length <= MAX_DOTS

  return (
    <div
      className="fixed inset-x-0 top-0 bottom-0 z-[70] bg-ink-900 flex flex-col"
      style={{ bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
    >
      <div className="shrink-0 flex items-center justify-between px-2.5 pb-2 [--safe-pt-base:0.5rem] safe-area-pt">
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button
          onClick={openMenu}
          aria-label="Photo options"
          className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      <div
        className={`shrink-0 relative flex items-center justify-center select-none ${
          keyboardInset > 0 ? 'h-[18vh]' : 'h-[38vh]'
        }`}
        onTouchStart={e => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={e => {
          const start = touchX.current
          touchX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start === null || end === undefined) return
          const dx = end - start
          if (dx <= -SWIPE_PX) go(1)
          else if (dx >= SWIPE_PX) go(-1)
        }}
      >
        <img
          key={photo.id}
          src={photo.url}
          alt={`Photo by ${ownerName}`}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
        {/* Desktop affordance; on a phone the swipe is the way. */}
        {index > 0 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next photo"
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="shrink-0 flex gap-[5px] justify-center pt-2.5 pb-3 min-h-[27px]">
        {dots &&
          photos.map((p, i) => (
            <i
              key={p.id}
              className={`block w-[5px] h-[5px] rounded-full ${i === index ? 'bg-white/75' : 'bg-white/25'}`}
            />
          ))}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-t-[22px] flex flex-col">
        <div className="shrink-0 flex items-center gap-[9px] px-[18px] pt-3.5">
          <Avatar src={photo.uploaderAvatar} name={photo.uploaderName ?? '?'} size={28} className="shrink-0" />
          <b className="font-sans text-[13.5px] font-bold text-ink-900">{ownerName}</b>
          <span className="font-sans text-[13.5px] text-ink-500">· {commentTime(photo.createdAt)}</span>
        </div>
        <div className="shrink-0 h-px bg-[#E8E4F5] mx-[18px] mt-3" />
        <PhotoComments
          planId={planId}
          photoId={photo.id}
          meId={meId}
          isCreator={isCreator}
          authorId={authorId}
          roster={roster}
        />
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 bg-ink-900/50 z-[80]" onClick={() => setMenu(null)} aria-hidden="true" />
          {menu === 'list' ? (
            <div className="fixed bottom-0 left-0 right-0 z-[81] px-2 [--safe-pb-base:1.625rem] flex flex-col gap-2 safe-area-pb">
              <div className="rounded-2xl overflow-hidden border border-[#E8E4F5] bg-purple-50/95 backdrop-blur-xl">
                <p className="font-sans text-[12px] font-medium text-ink-500 text-center px-4 pt-3 pb-2 border-b border-[#E8E4F5] leading-snug">
                  {mine ? 'Your photo' : photo.uploaderName ? `${photo.uploaderName}'s photo` : 'Their photo'}
                </p>
                <button
                  onClick={() => void handleSave()}
                  className="w-full py-4 font-sans text-[17px] font-semibold text-purple-500"
                >
                  Save
                  {saveFailed && (
                    <span className="block font-sans text-[12px] font-medium text-red-500 mt-1">
                      Couldn&apos;t get the photo. Try again
                    </span>
                  )}
                </button>
                {canRemove && (
                  <button
                    onClick={() => setMenu('confirm')}
                    className="w-full py-4 px-3 font-sans text-[17px] font-semibold text-red-500 border-t border-[#E8E4F5]"
                  >
                    {mine ? 'Delete photo' : 'Remove photo'}
                    {!mine && (
                      <span className="block font-sans text-[12px] font-medium text-ink-500 leading-snug mt-1 px-1.5">
                        You started this Moove, so you can remove any photo.
                      </span>
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={() => setMenu(null)}
                className="w-full py-4 rounded-2xl border border-[#E8E4F5] bg-purple-50/95 backdrop-blur-xl font-sans text-[17px] font-bold text-ink-900"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              className="fixed bottom-0 left-0 right-0 z-[81] bg-white rounded-t-3xl px-5 pt-5 [--safe-pb-base:1.875rem] safe-area-pb"
              role="dialog"
              aria-modal="true"
            >
              <h2 className="font-display font-extrabold text-[18px] text-ink-900 tracking-tight mb-1.5">
                {mine
                  ? 'Delete this photo?'
                  : photo.uploaderName
                    ? `Remove ${photo.uploaderName}'s photo?`
                    : 'Remove this photo?'}
              </h2>
              <p className="font-sans text-[13.5px] text-ink-500 leading-relaxed mb-5">
                It disappears from the album for everyone, and its comments go with it.
              </p>
              <button
                onClick={() => void handleRemove()}
                disabled={working}
                className="w-full py-3.5 rounded-2xl bg-red-tint text-red-500 font-sans font-semibold text-[15px] mb-2 disabled:opacity-50"
              >
                {mine ? 'Delete photo' : 'Remove photo'}
              </button>
              <button
                onClick={() => setMenu(null)}
                className="w-full py-3.5 rounded-2xl bg-purple-50 text-ink-500 font-sans font-semibold text-[15px]"
              >
                Keep it
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
