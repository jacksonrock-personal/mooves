// Seeds public.metros + public.metro_zips (Phase 24, pass 1).
//
// Pairs with migration 20260803120000, the same way seed-zipcodes.mjs pairs with
// 0003: the tables are inert until this runs.
//
// THE RULE: the metro list is driven by where users actually are. It reads the
// distinct users.area_zip values, resolves each against zip_codes, and creates
// one metro per genuine cluster. A city within MERGE_MILES of a metro that
// already exists is folded into it rather than becoming its own — otherwise
// Evanston and Chicago would be two metros pulling the same events twice, which
// is the exact redundancy metros exist to prevent.
//
// Zip membership is filled by the existing nearby_zips() RPC rather than
// reimplementing distance maths here: it is already indexed (GiST over
// ll_to_earth) and already correct.
//
// Safe to re-run. Existing metros are matched by (name, state) and updated in
// place; metro_zips upserts ignore conflicts, so a zip already claimed by
// another metro stays where it is.
//
// R33 — this is now the BACKFILL, not the mechanism. /api/users/area creates the
// metro when somebody sets an area (ensure_metro_for_zip), so the steady state
// needs nothing from this file. Keep it for bulk repair: it is the only thing
// that re-derives the whole list from scratch and the only thing that can widen
// an existing metro's zip claim after a radius change.
//
// Usage:  node scripts/seed-metros.mjs
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (environment, or
// .env.local).

import { readFileSync } from 'node:fs'

// How far out each metro claims zips. Matches metros.radius_miles DEFAULT 30.
const RADIUS_MILES = 30
// Two candidate cities closer than this are the same metro.
const MERGE_MILES = 20

/**
 * Rows per metro_zips POST.
 *
 * Brooklyn claims 809 zips and used to go up as ONE request. On 2026-09-11 that
 * request came back 504 Gateway Timeout — harmlessly, because it landed on the
 * last metro in the list and every row in it was already a duplicate. One metro
 * earlier and the throw below would have left Princeton and Hailey sitting in
 * `metros` with zero rows in `metro_zips`, which /api/ingest/community-moves
 * rejects with a 409 for as long as it takes somebody to notice.
 */
const CHUNK_SIZE = 200

/** Attempts per request, including the first. */
const MAX_ATTEMPTS = 4

const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || process.env[m[1]]) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  } catch {
    // no .env.local — rely on the ambient environment
  }
}
loadEnvLocal()

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

/**
 * RETRIES ARE SAFE HERE, and only because of what is being written. Both writes
 * this script makes are idempotent: metros are matched by (name, state) before
 * insert, and metro_zips goes up with `resolution=ignore-duplicates` against a
 * primary key. A retry that duplicates a request the server actually applied is
 * therefore a no-op, which is what makes it correct to retry a POST at all — a
 * 504 tells you the gateway stopped waiting, NOT that the statement rolled back.
 *
 * 5xx and network faults retry. 4xx does not: a 400 is a bug in this script and
 * retrying it three more times just makes the log harder to read.
 */
async function rest(path, init = {}, attempt = 1) {
  let res
  try {
    res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    })
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err
    const wait = 500 * 2 ** (attempt - 1)
    console.warn(`  ⚠ ${init.method ?? 'GET'} ${path} failed (${err.message}); retry ${attempt + 1}/${MAX_ATTEMPTS} in ${wait}ms`)
    await sleep(wait)
    return rest(path, init, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text()
    if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
      const wait = 500 * 2 ** (attempt - 1)
      console.warn(`  ⚠ ${init.method ?? 'GET'} ${path} → ${res.status}; retry ${attempt + 1}/${MAX_ATTEMPTS} in ${wait}ms`)
      await sleep(wait)
      return rest(path, init, attempt + 1)
    }
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${body}`)
  }
  // PostgREST returns an EMPTY body for 204 and for any request sent with
  // `Prefer: return=minimal` (which answers 201 Created with no content).
  // Calling res.json() on that throws, and the throw killed this script after
  // the very first metro claimed its zips — leaving Brooklyn with all 809 rows
  // and Chicago, San Francisco and Centreville with none. Parse the text and
  // only decode when there is something to decode.
  const text = await res.text()
  return text.length > 0 ? JSON.parse(text) : null
}

// Great-circle miles between two centroids.
function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function main() {
  // 1 — where users actually are.
  const users = await rest('users?select=area_zip&area_zip=not.is.null')
  const zips = [...new Set(users.map(u => u.area_zip).filter(Boolean))]
  if (!zips.length) {
    console.log('No users have an area_zip yet. Nothing to seed.')
    return
  }
  console.log(`${zips.length} distinct user zip${zips.length === 1 ? '' : 's'}.`)

  // 2 — resolve them to centroids.
  const rows = await rest(
    `zip_codes?select=zip,city,state,lat,lng&zip=in.(${zips.join(',')})`,
  )
  const byZip = new Map(rows.map(r => [r.zip, r]))
  const unresolved = zips.filter(z => !byZip.has(z))
  if (unresolved.length) {
    console.warn(`⚠ ${unresolved.length} zip(s) not in zip_codes, skipped: ${unresolved.join(', ')}`)
  }

  // 3 — collapse to metros. Sorted so the result is deterministic across runs
  // rather than depending on row order.
  const candidates = [...byZip.values()].sort((a, b) => a.zip.localeCompare(b.zip))
  const metros = []
  for (const c of candidates) {
    const near = metros.find(m => milesBetween(m.lat, m.lng, c.lat, c.lng) <= MERGE_MILES)
    if (near) continue
    metros.push({ name: c.city, state: c.state, lat: c.lat, lng: c.lng, seedZip: c.zip })
  }
  console.log(`→ ${metros.length} metro${metros.length === 1 ? '' : 's'}: ${metros.map(m => `${m.name}, ${m.state}`).join(' · ')}`)

  // 4 — upsert metros. The unique index is on (lower(name), lower(state)), so
  // re-running matches rather than duplicating.
  for (const m of metros) {
    const existing = await rest(
      `metros?select=id&name=eq.${encodeURIComponent(m.name)}&state=eq.${encodeURIComponent(m.state)}`,
    )
    if (existing.length) {
      m.id = existing[0].id
    } else {
      const created = await rest('metros', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name: m.name,
          state: m.state,
          lat: m.lat,
          lng: m.lng,
          radius_miles: RADIUS_MILES,
        }),
      })
      m.id = created[0].id
    }
  }

  // 5 — claim zips by radius, via the existing indexed RPC.
  //
  // One metro's failure must not become every later metro's failure. This loop
  // used to let a throw escape, which meant the blast radius of a transient
  // upstream blip was "every metro sorted after the unlucky one silently ends up
  // with no zips" — invisible here, and a permanent 409 at ingest time.
  let claimed = 0
  const failed = []

  async function claimZips(m) {
    const near = await rest('rpc/nearby_zips', {
      method: 'POST',
      body: JSON.stringify({ p_zip: m.seedZip, p_radius_miles: RADIUS_MILES }),
    })

    const batch = (near ?? []).map(r => ({ zip: r.zip, metro_id: m.id }))
    if (!batch.length) return

    // ignore-duplicates: a zip already owned by an earlier metro keeps its
    // owner. metro_zips.zip is the primary key, so membership is exclusive.
    //
    // Chunked so no single request is large enough to time out the gateway, and
    // so a chunk that does fail retries by itself rather than taking every metro
    // after this one down with it.
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      await rest('metro_zips', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(batch.slice(i, i + CHUNK_SIZE)),
      })
    }
    claimed += batch.length
    console.log(`  ${m.name}, ${m.state} → ${batch.length} zips`)
  }

  for (const m of metros) {
    try {
      await claimZips(m)
    } catch (err) {
      failed.push(`${m.name}, ${m.state}: ${err.message}`)
      console.error(`  ✗ ${m.name}, ${m.state} → ${err.message}`)
    }
  }

  console.log(`Done. ${metros.length} metros, ${claimed} zip claims attempted.`)

  if (failed.length) {
    console.error(`\n${failed.length} metro(s) did NOT get their zips:`)
    for (const f of failed) console.error(`  · ${f}`)
    console.error('\nThese have a metros row and no metro_zips rows, which makes')
    console.error('/api/ingest/community-moves return 409 for them. Re-run this script.')
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
