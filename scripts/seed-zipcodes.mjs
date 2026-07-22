// One-time seed for the public.zip_codes table (migration 0003).
// Reads US zip centroids from the `zipcodes` npm package and upserts them into
// Supabase in batches via the PostgREST endpoint (service-role key).
//
// Uses Node's built-in fetch (Node 18+) — deliberately NOT @supabase/supabase-js,
// which tries to init a realtime websocket that Node < 22 lacks. Safe to re-run.
//
// Usage:  node scripts/seed-zipcodes.mjs
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from the
// environment, or from .env.local if not already set).

import zipcodes from 'zipcodes'
import { readFileSync } from 'node:fs'

// Minimal .env.local loader so you don't need extra tooling to run this.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked env + .env.local).')
  process.exit(1)
}

const endpoint = `${url.replace(/\/$/, '')}/rest/v1/zip_codes`

const rows = Object.values(zipcodes.codes)
  .filter(r => r && r.zip && r.latitude != null && r.longitude != null)
  .map(r => ({ zip: r.zip, city: r.city ?? null, state: r.state ?? null, lat: r.latitude, lng: r.longitude }))

console.log(`Seeding ${rows.length} zip codes...`)

const BATCH = 1000
let done = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // Upsert on the primary key (zip); don't send the rows back.
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(chunk),
  })
  if (!res.ok) {
    console.error(`Batch failed (HTTP ${res.status}):`, await res.text())
    process.exit(1)
  }
  done += chunk.length
  console.log(`  ${done}/${rows.length}`)
}

console.log('Done.')
