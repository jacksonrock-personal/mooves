'use client'

// R36 — a past Moove's album.
//
// A tall Moove sheet over the feed (MooveSheet's geometry, taller): the Moove
// restated at the top, [Add photos], a divider, then the grid. Three across,
// newest first, square crops. Your own picks land at the front of the grid the
// moment you choose them, each with its own progress ring; a failed one says so
// and retries on tap. Nobody else sees a photo until it has finished.
//
// The button has three other states, all in the same spot:
//   closed (> 30 days after the Moove) → one quiet line saying why
//   at your cap (50)                   → a flat grey panel, not a button
//   loading                            → nothing yet
//
// Only the author and the people who joined can open this. Everyone else gets
// a 404 from the API, which closes the sheet without a word — no hint.

import { useCallback, useEffect, useRef, useState } from 'react'
import { posthog } from '@/lib/posthog'
import { useSheetDrag } from '@/lib/useSheetDrag'
import SheetGrabber from '@/components/ui/SheetGrabber'
import CowIllustration from '@/components/ui/CowIllustration'
import {
  PHOTO_CAP_PER_PERSON,
  albumWhenLine,
  whoWasInLine,
  type Album,
  type AlbumPhoto,
} from '@/lib/photos'
import { UploadRefused, runLimited, uploadPhoto } from '@/lib/photoClient'
import AvatarStack from './AvatarStack'
import PhotoViewer from './PhotoViewer'

interface AlbumSheetProps {
  planId: string
  meId: string
  meName: string | null
  meAvatar: string | null
  onClose: () => void
  /** Something in the album changed; the Past row's thumbnails may be stale. */
  onChanged: () => void
}

interface Upload {
  key: string
  file: File
  preview: string
  progress: number
  failed: boolean
}

const CONCURRENCY = 3

function Ring({ progress }: { progress: number }) {
  const r = 12
  const c = 2 * Math.PI * r
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        transform="rotate(-90 16 16)"
      />
    </svg>
  )
}

export default function AlbumSheet({ planId, meId, meName, meAvatar, onClose, onChanged }: AlbumSheetProps) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [viewing, setViewing] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openedRef = useRef(false)
  const drag = useSheetDrag(onClose)
  // The feed passes a fresh closure every render; hold the latest in a ref so
  // `load` (and the focus listener) stay stable across feed re-renders.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans/${planId}/photos`)
      if (res.status === 404) {
        // Not a member, cancelled, or not over yet. Say nothing.
        onCloseRef.current()
        return
      }
      if (!res.ok) {
        setLoadError(true)
        return
      }
      const data = (await res.json()) as Album
      setAlbum(data)
      setLoadError(false)
      if (!openedRef.current) {
        openedRef.current = true
        posthog.capture('album_opened', { photos: data.photos.length, isCreator: data.isCreator })
      }
    } catch {
      setLoadError(true)
    }
  }, [planId])

  useEffect(() => {
    void load()
    // Signed URLs last about an hour; coming back to the app refreshes them.
    function onFocus() {
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  // Free the local previews when the sheet goes away.
  const uploadsRef = useRef<Upload[]>([])
  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])
  useEffect(
    () => () => {
      for (const u of uploadsRef.current) URL.revokeObjectURL(u.preview)
    },
    [],
  )

  const closed = album ? Date.now() >= new Date(album.closesAt).getTime() : false
  const inFlight = uploads.filter(u => !u.failed).length
  const used = (album?.myCount ?? 0) + uploads.length
  const atCap = used >= PHOTO_CAP_PER_PERSON

  function setProgress(key: string, progress: number) {
    setUploads(us => us.map(u => (u.key === key ? { ...u, progress } : u)))
  }

  /** One file through the pipeline. Resolves true on success. */
  async function runOne(u: Upload): Promise<boolean> {
    try {
      const done = await uploadPhoto(planId, u.file, p => setProgress(u.key, p))
      const photo: AlbumPhoto = {
        id: done.id,
        uploaderId: meId,
        uploaderName: meName,
        uploaderAvatar: meAvatar,
        createdAt: done.createdAt,
        width: done.width,
        height: done.height,
        url: done.url ?? u.preview,
      }
      setUploads(us => us.filter(x => x.key !== u.key))
      if (done.url) URL.revokeObjectURL(u.preview)
      setAlbum(a => (a ? { ...a, photos: [photo, ...a.photos], myCount: a.myCount + 1 } : a))
      return true
    } catch (e) {
      if (e instanceof UploadRefused) {
        // Window closed or cap reached under us: drop the tile and resync the
        // button from the server's truth.
        setUploads(us => us.filter(x => x.key !== u.key))
        URL.revokeObjectURL(u.preview)
        void load()
        return false
      }
      setUploads(us => us.map(x => (x.key === u.key ? { ...x, failed: true } : x)))
      return false
    }
  }

  /** The end of a batch: one push for the lot, never one per photo. */
  function batchDone(succeeded: number) {
    if (succeeded === 0) return
    posthog.capture('album_photos_added', { count: succeeded })
    void fetch(`/api/plans/${planId}/photos/added`, { method: 'POST' }).catch(() => {})
    onChanged()
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !album) return
    // The cap is enforced on the server; this keeps the client from starting
    // uploads it already knows will be refused.
    const room = Math.max(0, PHOTO_CAP_PER_PERSON - used)
    const files = Array.from(list)
      .filter(f => f.type === '' || f.type.startsWith('image/'))
      .slice(0, room)
    if (files.length === 0) return

    const batch: Upload[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      failed: false,
    }))
    setUploads(us => [...batch, ...us])

    let ok = 0
    await runLimited(
      batch.map(u => async () => {
        if (await runOne(u)) ok += 1
      }),
      CONCURRENCY,
    )
    batchDone(ok)
  }

  async function retry(u: Upload) {
    setUploads(us => us.map(x => (x.key === u.key ? { ...x, failed: false, progress: 0 } : x)))
    if (await runOne({ ...u, failed: false, progress: 0 })) batchDone(1)
  }

  function handleRemoved(photoId: string) {
    setAlbum(a => {
      if (!a) return a
      const gone = a.photos.find(p => p.id === photoId)
      const photos = a.photos.filter(p => p.id !== photoId)
      const myCount = gone && gone.uploaderId === meId ? a.myCount - 1 : a.myCount
      return { ...a, photos, myCount }
    })
    setViewing(v => {
      if (v === null || !album) return v
      const remaining = album.photos.length - 1
      if (remaining <= 0) return null
      return Math.min(v, remaining - 1)
    })
    onChanged()
  }

  const people = album?.people ?? []
  const total = people.length
  const footLine =
    total <= 1 ? 'Only you can see these.' : `Only the ${total} of you who were there can see these.`

  return (
    <>
      <div
        className="fixed inset-0 bg-ink-900/45 z-40"
        style={{ opacity: drag.scrimOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[22px] flex flex-col h-[90%] shadow-[0_-8px_40px_rgba(28,23,48,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={album?.plan.title ?? 'Album'}
        {...drag.sheetProps}
      >
        <SheetGrabber drag={drag} className="mt-[18px]" pillClassName="w-11 h-[5px] rounded-full bg-[#DDD8EC]" />

        {!album && !loadError && (
          <p className="px-4 pt-6 font-sans text-[13px] text-grey-300">Loading</p>
        )}
        {!album && loadError && (
          <button
            onClick={() => void load()}
            className="px-4 pt-6 text-left font-sans text-[13px] font-semibold text-purple-500"
          >
            Couldn&apos;t load this album. Try again
          </button>
        )}

        {album && (
          <>
            <div className="shrink-0 px-4 pt-3.5" {...drag.headerProps}>
              <h2 className="font-display font-extrabold text-[19px] leading-tight tracking-tight text-ink-900 flex items-center gap-2 flex-wrap">
                <span className="min-w-0">{album.plan.title}</span>
                {album.isCreator && (
                  <span className="font-sans text-[10.5px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                    Your Moove
                  </span>
                )}
              </h2>
              <p className="font-sans text-[12.5px] leading-snug text-ink-500 mt-1">
                {albumWhenLine(
                  album.plan.startAt,
                  album.plan.hasTime,
                  album.plan.timeMode,
                  album.plan.locationText,
                )}
              </p>
              <div className="flex items-center mt-[11px]">
                <AvatarStack people={people} size={26} max={4} overlapClassName="-ml-[9px]" />
                <span className="font-sans text-[12.5px] font-semibold text-ink-500 ml-2 min-w-0 truncate">
                  {whoWasInLine(people, meId, true)}
                </span>
              </div>
            </div>

            {closed ? (
              <p className="shrink-0 mx-4 mt-3 px-0.5 pt-0.5 font-sans text-[12.5px] font-medium text-ink-500">
                Adding photos closed 30 days after the Moove.
              </p>
            ) : atCap ? (
              <div className="shrink-0 mx-4 mt-3.5 px-3.5 py-3 rounded-2xl bg-grey-100 font-sans text-[13px] font-semibold text-ink-500 text-center leading-snug">
                You&apos;ve added {PHOTO_CAP_PER_PERSON}
              </div>
            ) : (
              <>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="shrink-0 mx-4 mt-3.5 py-[13px] rounded-2xl bg-purple-500 text-white font-display font-extrabold text-[15px] tracking-tight flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(124,92,219,0.28)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M8 5l1.5-2h5L16 5" />
                  </svg>
                  Add photos
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    void handleFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </>
            )}

            <div className="shrink-0 h-px bg-[#E8E4F5] mx-4 mt-3.5" />

            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" {...drag.contentProps}>
              {album.photos.length === 0 && uploads.length === 0 ? (
                <div className="flex flex-col items-center text-center px-[22px] pt-[34px]">
                  <CowIllustration size={72} />
                  <h3 className="font-display font-extrabold text-[16px] tracking-tight text-ink-900 mt-3.5">
                    No photos yet
                  </h3>
                  {!closed && (
                    <p className="font-sans text-[13px] text-ink-500 leading-relaxed mt-1">
                      Add yours, and everyone who was there can see them.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-[3px] rounded-xl overflow-hidden">
                    {uploads.map(u => (
                      <div key={u.key} className="relative aspect-square bg-grey-100">
                        <img src={u.preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        {u.failed ? (
                          <button
                            onClick={() => void retry(u)}
                            className="absolute inset-0 bg-ink-900/65 flex flex-col items-center justify-center gap-[5px]"
                            aria-label="Retry upload"
                          >
                            <span className="w-[34px] h-[34px] rounded-full bg-white flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1730" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                            </span>
                            <span className="font-sans text-[10.5px] font-bold text-white">Retry</span>
                          </button>
                        ) : (
                          <div className="absolute inset-0 bg-ink-900/40 flex items-center justify-center">
                            <Ring progress={u.progress} />
                          </div>
                        )}
                      </div>
                    ))}
                    {album.photos.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => setViewing(i)}
                        className="relative aspect-square bg-grey-100"
                        aria-label={`Photo by ${p.uploaderId === meId ? 'you' : (p.uploaderName ?? 'someone')}`}
                      >
                        <img
                          src={p.url}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                  {album.photos.length > 0 && (
                    <p className="font-sans text-[11.5px] font-medium text-grey-300 text-center mt-3">{footLine}</p>
                  )}
                </>
              )}
              {inFlight > 0 && <span className="sr-only">Uploading {inFlight}</span>}
            </div>
          </>
        )}
      </div>

      {album && viewing !== null && album.photos[viewing] && (
        <PhotoViewer
          planId={planId}
          photos={album.photos}
          index={viewing}
          meId={meId}
          isCreator={album.isCreator}
          authorId={album.plan.authorId}
          roster={album.people}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onRemoved={handleRemoved}
        />
      )}
    </>
  )
}
