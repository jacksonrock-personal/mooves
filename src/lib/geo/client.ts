// Client-side helpers for capturing a coarse area. The precise device
// coordinates are sent to our own API, coarsened to a zip server-side, and
// discarded — they are never stored. Only the resulting zip is persisted.

export interface CoarseArea {
  zip: string
  city: string
  state: string
}

/** Thrown when the device blocks geolocation (permission denied or unsupported). */
export class GeolocationDeniedError extends Error {}

/** Thrown when a manually entered zip isn't a valid US zip. */
export class InvalidZipError extends Error {}

function getPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GeolocationDeniedError('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => {
        if (err.code === err.PERMISSION_DENIED) reject(new GeolocationDeniedError('denied'))
        else reject(new Error('geolocation_failed'))
      },
      // Coarse is enough — no high-accuracy GPS lock.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    )
  })
}

/** Get the device location, coarsen it to a zip server-side, and save it. */
export async function captureDeviceArea(): Promise<CoarseArea> {
  const coords = await getPosition()
  const res = await fetch('/api/users/area', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
  })
  if (!res.ok) throw new Error('area_save_failed')
  return res.json() as Promise<CoarseArea>
}

/** Save a manually entered zip. Throws InvalidZipError for a non-US / malformed zip. */
export async function saveManualZip(zip: string): Promise<CoarseArea> {
  const res = await fetch('/api/users/area', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zip }),
  })
  if (res.status === 422) throw new InvalidZipError('invalid_zip')
  if (!res.ok) throw new Error('area_save_failed')
  return res.json() as Promise<CoarseArea>
}

/** Remove the stored coarse area. */
export async function removeArea(): Promise<void> {
  const res = await fetch('/api/users/area', { method: 'DELETE' })
  if (!res.ok) throw new Error('area_remove_failed')
}
