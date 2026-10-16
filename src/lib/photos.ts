// R36 — Past Mooves + photo albums.
//
// Client-safe: constants, response types and pure helpers, plus the one access
// rule every album route shares. The rule takes its Supabase client as an
// argument rather than importing the server module, so this file can be pulled
// into client components for the constants without dragging next/headers in.
//
// ⚠ Phase 21 wall 4 is amended here FOR PHOTO COMMENTS ONLY: they live as long
// as the photo. Walls 1–3 hold exactly — only on a Moove, only author + joiners
// of THAT Moove, never shown or hinted to anyone else. See the migration
// 20261016140000_r36_photo_albums.sql for the full statement.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { PlanTimeMode } from '@/lib/plans'

/** Server-enforced: per uploader, per Moove. */
export const PHOTO_CAP_PER_PERSON = 50
/** Server-enforced: uploads close this many days after the Moove's start. */
export const ALBUM_OPEN_DAYS = 30
/** Signed read URLs live about an hour; the album refetches on focus. */
export const PHOTO_URL_TTL_SECONDS = 3600
export const PHOTO_BUCKET = 'plan-photos'
/** Client-side resize target. */
export const PHOTO_MAX_EDGE = 2048
export const PHOTO_JPEG_QUALITY = 0.85

export interface AlbumPerson {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export interface PastMoove {
  id: string
  title: string
  startAt: string
  hasTime: boolean
  timeMode: PlanTimeMode
  locationText: string | null
  isCreator: boolean
  authorId: string
  /** Author first, then joiners. Includes the viewer. */
  people: AlbumPerson[]
  thumbs: string[]
  /** A total, shown to members only. Never an unread count. */
  photoCount: number
}

export interface AlbumPhoto {
  id: string
  uploaderId: string
  uploaderName: string | null
  uploaderAvatar: string | null
  createdAt: string
  width: number | null
  height: number | null
  url: string
}

export interface Album {
  plan: {
    id: string
    title: string
    startAt: string
    hasTime: boolean
    timeMode: PlanTimeMode
    locationText: string | null
    authorId: string
  }
  people: AlbumPerson[]
  photos: AlbumPhoto[]
  myCount: number
  canAdd: boolean
  isCreator: boolean
  closesAt: string
}

/** When adding photos stops for a Moove that started at `startAt`. */
export function albumClosesAt(startAt: string): Date {
  return new Date(new Date(startAt).getTime() + ALBUM_OPEN_DAYS * 24 * 60 * 60 * 1000)
}

export function albumIsOpen(startAt: string, now: Date = new Date()): boolean {
  return now.getTime() < albumClosesAt(startAt).getTime()
}

/** "Sat Oct 11" */
export function pastDay(startAt: string): string {
  const d = new Date(startAt)
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${wd} ${md}`
}

/** Past row's grey tile: "SAT" / "OCT 11". Always the date, whatever the mode. */
export function pastTile(startAt: string): { top: string; bottom: string } {
  const d = new Date(startAt)
  return {
    top: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    bottom: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
  }
}

/** Past row: "Sat Oct 11, Pilsen". */
export function pastWhenLine(startAt: string, locationText: string | null): string {
  const place = locationText?.trim()
  return place ? `${pastDay(startAt)}, ${place}` : pastDay(startAt)
}

/** Album header: "Sat Oct 11 · 7:30 PM · Lupe's Taqueria, Pilsen". */
export function albumWhenLine(
  startAt: string,
  hasTime: boolean,
  timeMode: PlanTimeMode,
  locationText: string | null,
): string {
  const parts = [pastDay(startAt)]
  if (hasTime && timeMode === 'datetime') {
    parts.push(new Date(startAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  }
  const place = locationText?.trim()
  if (place) parts.push(place)
  return parts.join(' · ')
}

/**
 * Who was in, without the viewer. "Chloe, John, Ari +2" · "Dev, Maya".
 * `andYou` appends " and you" when the list is short enough to say it.
 */
export function whoWasInLine(people: AlbumPerson[], meId: string, andYou = false): string {
  const others = people.filter(p => p.id !== meId).map(p => p.displayName ?? 'Someone')
  const includesMe = people.some(p => p.id === meId)
  if (others.length === 0) return includesMe ? 'Just you' : ''
  if (others.length > 3) return `${others.slice(0, 3).join(', ')} +${others.length - 3}`
  const list = others.join(', ')
  return andYou && includesMe ? `${list} and you` : list
}

// ── Server-side access ──────────────────────────────────────────────────────

type Supabase = SupabaseClient<Database>

export interface AlbumAccess {
  planId: string
  authorId: string
  title: string
  startAt: string
  hasTime: boolean
  timeMode: PlanTimeMode
  locationText: string | null
  isCreator: boolean
}

/**
 * Can this user see this Moove's album? The one rule, checked on every route.
 *
 *   • the plan exists and was not cancelled;
 *   • it is over — expires_at has passed, which is the stored form of the same
 *     instant isPlanOver() computes on the client;
 *   • the user is the author, OR holds a move_joins row whose plan_id IS this
 *     plan. plan_id is matched explicitly: a green join carries plan_id NULL
 *     and must never read as membership of a Moove.
 *
 * Null means "not found" to the caller, always — a 403 would admit the album
 * exists.
 */
export async function canAccessAlbum(
  supabase: Supabase,
  planId: string,
  userId: string,
): Promise<AlbumAccess | null> {
  if (!planId || !userId) return null

  const { data: plan } = await supabase
    .from('plans')
    .select('id, author_id, title, start_at, has_time, time_mode, location_text, cancelled_at, expires_at')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) return null
  if (plan.cancelled_at) return null
  if (new Date(plan.expires_at).getTime() > Date.now()) return null

  const base: AlbumAccess = {
    planId: plan.id,
    authorId: plan.author_id,
    title: plan.title,
    startAt: plan.start_at,
    hasTime: plan.has_time,
    timeMode: plan.time_mode as PlanTimeMode,
    locationText: plan.location_text,
    isCreator: plan.author_id === userId,
  }
  if (base.isCreator) return base

  const { data: join } = await supabase
    .from('move_joins')
    .select('id')
    .eq('plan_id', planId)
    .eq('joiner_id', userId)
    .not('plan_id', 'is', null)
    .limit(1)
    .maybeSingle()

  return join ? base : null
}

/** Author + current joiners of a plan, author first. */
export async function albumRoster(
  supabase: Supabase,
  planId: string,
  authorId: string,
): Promise<AlbumPerson[]> {
  const { data: joins } = await supabase
    .from('move_joins')
    .select('joiner_id, created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })

  const ids = [...new Set([authorId, ...(joins ?? []).map(j => j.joiner_id)])]
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', ids)
  const byId = new Map((users ?? []).map(u => [u.id, u]))
  return ids.map(id => ({
    id,
    displayName: byId.get(id)?.display_name ?? null,
    avatarUrl: byId.get(id)?.avatar_url ?? null,
  }))
}

/** Accepts only `${planId}/${userId}/${uuid}.jpg`. Anything else is tampering. */
export function isOwnPhotoPath(path: unknown, planId: string, userId: string): path is string {
  if (typeof path !== 'string') return false
  const prefix = `${planId}/${userId}/`
  if (!path.startsWith(prefix)) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/.test(path.slice(prefix.length))
}

/**
 * The photo, if it belongs to THIS plan. Used after canAccessAlbum so a valid
 * photo id from another album can never be reached through one the caller is
 * in.
 */
export async function photoInAlbum(
  supabase: Supabase,
  planId: string,
  photoId: string,
): Promise<{ id: string; uploaderId: string; storagePath: string } | null> {
  if (!photoId) return null
  const { data } = await supabase
    .from('plan_photos')
    .select('id, uploader_id, storage_path')
    .eq('id', photoId)
    .eq('plan_id', planId)
    .maybeSingle()
  return data ? { id: data.id, uploaderId: data.uploader_id, storagePath: data.storage_path } : null
}
