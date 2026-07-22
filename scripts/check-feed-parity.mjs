// Parity check for the P4 feed refactor (migration 0005).
// For every user, computes the feed TWO ways and deep-compares them:
//   A) the new get_feed() RPC
//   B) a faithful JS replica of the OLD /api/feed route logic (via REST)
// Prints per-user OK / DIFF and a final summary. Run AFTER applying 0005 and
// BEFORE deploying the route change. 0 diffs = safe to ship.
//
// Usage: node scripts/check-feed-parity.mjs

import { readFileSync } from 'node:fs'

const ENV_PATH = new URL('../.env.local', import.meta.url)
function loadEnv() {
  const e = {}
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    e[m[1]] = v
  }
  return e
}
const env = loadEnv()
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const rest = (path) => fetch(`${URL_BASE}/rest/v1/${path}`, { headers: H }).then(r => r.json())
const inList = (ids) => `(${ids.join(',')})`

// ── B) faithful replica of the current /api/feed route ────────────────────────
async function replicaFeed(viewer) {
  const friendships = await rest(`friendships?user_id=eq.${viewer}&select=friend_id`)
  const friendIds = (friendships ?? []).map(f => f.friend_id)
  if (friendIds.length === 0) return { friends: [], myJoiners: [], ambient: { activeNow: 0, recentGreen: 0 } }

  const now = Date.now()
  const activeCut = now - 15 * 60 * 1000
  const greenCut = now - 7 * 24 * 60 * 60 * 1000
  const ambientRows = await rest(`users?id=in.${inList(friendIds)}&select=last_active_at,last_green_at`)
  const ambient = {
    activeNow: (ambientRows ?? []).filter(u => u.last_active_at && Date.parse(u.last_active_at) > activeCut).length,
    recentGreen: (ambientRows ?? []).filter(u => u.last_green_at && Date.parse(u.last_green_at) > greenCut).length,
  }

  const green = await rest(
    `users?id=in.${inList(friendIds)}&is_available=eq.true&select=id,display_name,avatar_url,status_note,status_time,status_move_id,phone,status_set_at,visible_to&order=status_set_at.desc.nullslast`)

  const memberOf = await rest(`group_members?user_id=eq.${viewer}&select=group_id`)
  const myGroups = new Set((memberOf ?? []).map(m => m.group_id))
  const visible = (green ?? []).filter(f => !f.visible_to || f.visible_to.some(g => myGroups.has(g)))

  const anchorIds = [...new Set(visible.map(f => f.status_move_id).filter(Boolean))]
  const anchorMap = new Map()
  if (anchorIds.length) {
    const rows = await rest(`sponsored_moves?id=in.${inList(anchorIds)}&select=id,title,description,brand,category,time_text,link_url`)
    for (const m of rows ?? []) anchorMap.set(m.id, {
      id: m.id, title: m.title, description: m.description, brand: m.brand,
      category: m.category, timeText: m.time_text, linkUrl: m.link_url,
    })
  }

  const moverIds = [...visible.map(f => f.id), viewer]
  const joins = await rest(`move_joins?mover_id=in.${inList(moverIds)}&select=mover_id,joiner_id`)
  const joinRows = joins ?? []
  const joinerIds = [...new Set(joinRows.map(j => j.joiner_id))]
  const joinerMap = new Map()
  if (joinerIds.length) {
    const us = await rest(`users?id=in.${inList(joinerIds)}&select=id,display_name,avatar_url,phone`)
    for (const u of us ?? []) joinerMap.set(u.id, u)
  }
  const byMover = new Map()
  for (const j of joinRows) { const a = byMover.get(j.mover_id) ?? []; a.push(j.joiner_id); byMover.set(j.mover_id, a) }
  const joinersFor = (id) => (byMover.get(id) ?? []).map(i => joinerMap.get(i)).filter(Boolean)
    .map(u => ({ id: u.id, displayName: u.display_name, avatarUrl: u.avatar_url }))

  const friends = visible.map(f => ({
    id: f.id, displayName: f.display_name, avatarUrl: f.avatar_url, statusNote: f.status_note,
    statusTime: f.status_time, phone: f.phone, statusSetAt: f.status_set_at,
    joiners: joinersFor(f.id), joinedByMe: (byMover.get(f.id) ?? []).includes(viewer),
    anchoredMove: f.status_move_id ? anchorMap.get(f.status_move_id) ?? null : null,
  }))
  const myJoiners = (byMover.get(viewer) ?? []).map(i => joinerMap.get(i)).filter(Boolean)
    .map(u => ({ id: u.id, displayName: u.display_name, avatarUrl: u.avatar_url, phone: u.phone }))
  return { friends, myJoiners, ambient }
}

// Key-order-independent serialization: the RPC and the JS replica emit the same
// object keys in different orders, which JSON.stringify would falsely flag.
function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

// ── normalize so order-of-ties / timestamp formatting don't cause false diffs ──
function canon(feed) {
  const ts = (v) => (v == null ? null : Date.parse(v))
  const joiner = (j) => ({ ...j })
  const sortById = (arr) => [...(arr ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1))
  return {
    ambient: feed.ambient,
    myJoiners: sortById(feed.myJoiners).map(joiner),
    friends: sortById(feed.friends).map(f => ({
      ...f, statusSetAt: ts(f.statusSetAt), joiners: sortById(f.joiners).map(joiner),
    })),
  }
}

// ── run ───────────────────────────────────────────────────────────────────────
// Sanity: make sure get_feed exists before looping over every user.
const probe = await fetch(`${URL_BASE}/rest/v1/rpc/get_feed`, {
  method: 'POST', headers: H, body: JSON.stringify({ viewer: '00000000-0000-0000-0000-000000000000' }),
}).then(r => r.json())
if (probe && probe.code) {
  console.error('get_feed() not callable — did you apply migration 0005 first?\n', probe)
  process.exit(1)
}

const users = await rest('users?select=id')
let diffs = 0
for (const { id } of users ?? []) {
  const [rpcRes, replica] = await Promise.all([
    fetch(`${URL_BASE}/rest/v1/rpc/get_feed`, {
      method: 'POST', headers: H, body: JSON.stringify({ viewer: id }),
    }).then(r => r.json()),
    replicaFeed(id),
  ])

  const a = stableStringify(canon(rpcRes))
  const b = stableStringify(canon(replica))
  if (a === b) {
    console.log(`OK   ${id}  (friends ${replica.friends.length}, myJoiners ${replica.myJoiners.length})`)
  } else {
    diffs++
    console.log(`DIFF ${id}`)
    console.log('  rpc    :', a)
    console.log('  replica:', b)
  }
}
console.log(`\nusers checked: ${(users ?? []).length} | diffs: ${diffs}`)
process.exit(diffs === 0 ? 0 : 1)
