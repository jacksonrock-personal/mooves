// Sponsored-move date/time helpers (Phase 16 #13). Sponsors/admins pick a date +
// start time + location; we store a structured `start_at` (ISO) and `location_text`,
// AND denormalize a human display string into `time_text` so every existing render
// path (Discover, feed anchor, sponsor/admin lists) keeps working unchanged.
//
// Formatting is done here on the client from the picked parts, using a fixed en-US
// locale, so the string reflects the event's stated local time (no timezone drift
// from viewers in other zones — the area feed is local anyway).

// date = "YYYY-MM-DD" (from <input type="date">), time = "HH:MM" 24h (from <input type="time">).

export function combineStartAt(date: string, time: string): string | null {
  if (!date) return null
  const d = new Date(`${date}T${time || '00:00'}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// "Sun, Aug 3 · 10:00 AM · Logan Blvd" (time and location optional).
export function formatMoveWhen(date: string, time: string, location: string): string | null {
  const loc = location.trim()
  if (!date) return loc || null
  const d = new Date(`${date}T${time || '00:00'}`)
  if (Number.isNaN(d.getTime())) return loc || null
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const whenPart = time
    ? `${datePart} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : datePart
  return loc ? `${whenPart} · ${loc}` : whenPart
}

// Split a stored ISO `start_at` back into date + time input values (viewer-local),
// for prefilling the pickers when editing.
export function splitStartAt(startAt: string | null | undefined): { date: string; time: string } {
  if (!startAt) return { date: '', time: '' }
  const d = new Date(startAt)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

// The three datetime-derived fields sent to the move write APIs.
export function movePayloadFields(v: { startDate: string; startTime: string; locationText: string }): {
  startAt: string | null
  locationText: string | null
  timeText: string | null
} {
  return {
    startAt: combineStartAt(v.startDate, v.startTime),
    locationText: v.locationText.trim() || null,
    timeText: formatMoveWhen(v.startDate, v.startTime, v.locationText),
  }
}
