'use client'

// R36 — browser-side photo handling: resize, strip, upload, save.
//
// EXIF/GPS STRIPPING IS STRUCTURAL, not a filter. Every photo is decoded and
// redrawn onto a canvas, and only the canvas's pixels are exported — a canvas
// has no metadata to carry over, so location, camera serial and timestamps
// cannot survive the trip. The original file never leaves the device.

import { PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE } from '@/lib/photos'

export interface ProcessedPhoto {
  blob: Blob
  width: number
  height: number
}

function fit(w: number, h: number): { width: number; height: number } {
  const long = Math.max(w, h)
  if (long <= PHOTO_MAX_EDGE) return { width: w, height: h }
  const s = PHOTO_MAX_EDGE / long
  return { width: Math.round(w * s), height: Math.round(h * s) }
}

/** <img> fallback for browsers whose createImageBitmap rejects the format. */
function decodeWithImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode failed'))
    }
    img.src = url
  })
}

/** Decode (honouring EXIF orientation), shrink to ≤ 2048 long edge, re-encode JPEG. */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  let source: ImageBitmap | HTMLImageElement
  let w: number
  let h: number
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    source = bmp
    w = bmp.width
    h = bmp.height
  } catch {
    // Modern browsers apply EXIF orientation to <img> by default, so the
    // fallback is upright too.
    const img = await decodeWithImg(file)
    source = img
    w = img.naturalWidth
    h = img.naturalHeight
  }
  if (!w || !h) throw new Error('empty image')

  const size = fit(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size.width, size.height)
  if ('close' in source) source.close()

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY),
  )
  if (!blob) throw new Error('encode failed')
  return { blob, width: size.width, height: size.height }
}

/**
 * PUT the blob to a Supabase signed upload URL, with progress.
 *
 * XHR rather than fetch because fetch has no upload progress. The body shape
 * matches storage-js's uploadToSignedUrl: multipart with cacheControl and the
 * file under an empty field name.
 */
function putToSignedUrl(signedUrl: string, blob: Blob, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', blob, 'photo.jpg')

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('upload network error'))
    xhr.send(form)
  })
}

export class UploadRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadRefused'
  }
}

/**
 * The whole pipeline for one file: process → signed URL → upload → confirm.
 * Progress runs 0 → 0.1 for processing, 0.1 → 0.95 for the bytes, 1 on confirm.
 * Throws UploadRefused when the server says no for a reason a retry won't fix
 * (window closed, at cap).
 */
export async function uploadPhoto(
  planId: string,
  file: File,
  onProgress: (p: number) => void,
): Promise<{ id: string; createdAt: string; url: string | null; width: number; height: number }> {
  onProgress(0.02)
  const processed = await processPhoto(file)
  onProgress(0.1)

  const urlRes = await fetch(`/api/plans/${planId}/photos/upload-url`, { method: 'POST' })
  if (urlRes.status === 409) {
    const d = (await urlRes.json().catch(() => ({}))) as { error?: string }
    throw new UploadRefused(d.error ?? 'Not accepting photos')
  }
  if (!urlRes.ok) throw new Error('could not start upload')
  const { path, signedUrl } = (await urlRes.json()) as { path: string; signedUrl: string }

  await putToSignedUrl(signedUrl, processed.blob, p => onProgress(0.1 + p * 0.85))

  const confirm = await fetch(`/api/plans/${planId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, width: processed.width, height: processed.height }),
  })
  if (confirm.status === 409) {
    const d = (await confirm.json().catch(() => ({}))) as { error?: string }
    throw new UploadRefused(d.error ?? 'Not accepting photos')
  }
  if (!confirm.ok) throw new Error('confirm failed')
  const data = (await confirm.json()) as { id: string; createdAt: string; url: string | null }
  onProgress(1)
  return { ...data, width: processed.width, height: processed.height }
}

/** Run `tasks` with at most `limit` in flight. */
export async function runLimited(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
}

/**
 * Fetch a photo as a File, ready to save. Called when the "···" sheet OPENS,
 * not when Save is tapped: iOS only lets navigator.share() run inside the tap's
 * short user-activation window, and a network round trip between the tap and
 * the share call would spend it.
 */
export async function fetchPhotoFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('fetch failed')
  const blob = await res.blob()
  return new File([blob], filename, { type: 'image/jpeg' })
}

/**
 * Save: hand the file to the Web Share sheet where it can take files (iOS
 * offers "Save Image" there), and fall back to a plain download elsewhere.
 */
export async function saveFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // NotAllowedError (activation spent) and friends: fall through to download
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
  return 'downloaded'
}
