// R35 — Calendar sync settings.
//
// GET    /api/users/me/calendar — { url, webcalUrl, prompted }. url is null
//                                 until sync has been set up.
// POST   /api/users/me/calendar — set up: mint a token if there is none and
//                                 return the URLs. Idempotent, so tapping Apple
//                                 then Google never rotates anything.
//        body { reset: true }    — Reset link: always mint a new one. The old
//                                 URL stops resolving and 404s.
// DELETE /api/users/me/calendar — same as reset.
//
// The stored value is a nonce, not the URL token; see lib/calendarServer.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { feedUrls } from '@/lib/calendar'
import { appUrl, feedTokenFor, mintNonce } from '@/lib/calendarServer'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'

function urlsFor(nonce: string | null) {
  if (!nonce) return { url: null, webcalUrl: null }
  const { https, webcal } = feedUrls(feedTokenFor(nonce), appUrl())
  return { url: https, webcalUrl: webcal }
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('calendar_token, calendar_prompted_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...urlsFor(data.calendar_token),
    prompted: data.calendar_prompted_at !== null,
  })
}

async function mint(req: Request, rotate: boolean) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await checkRateLimit(`cal:mint:${userId}`, 20, 3600))) return tooManyRequests()

  const supabase = createServiceClient()

  if (!rotate) {
    const { data } = await supabase.from('users').select('calendar_token').eq('id', userId).maybeSingle()
    if (data?.calendar_token) return NextResponse.json(urlsFor(data.calendar_token))
  }

  const nonce = mintNonce()
  const { error } = await supabase.from('users').update({ calendar_token: nonce }).eq('id', userId)
  if (error) {
    console.error('calendar token write failed:', error)
    return NextResponse.json({ error: 'Could not set up calendar sync' }, { status: 500 })
  }

  // Setting up sync also spends the one-time prompt: someone who already has it
  // on must never be asked whether they would like it. Only ever written once.
  await supabase
    .from('users')
    .update({ calendar_prompted_at: new Date().toISOString() })
    .eq('id', userId)
    .is('calendar_prompted_at', null)

  return NextResponse.json(urlsFor(nonce))
}

export async function POST(req: Request) {
  let reset = false
  try {
    const body = (await req.json()) as { reset?: unknown }
    reset = body.reset === true
  } catch {
    // An empty body is a plain set-up.
  }
  return mint(req, reset)
}

export async function DELETE(req: Request) {
  return mint(req, true)
}
