// R37 — Text alerts settings.
//
// GET    /api/users/me/text-alerts → { status: 'off' | 'on' | 'stopped', phone }
//          'stopped' means they replied STOP (sms_opted_out_via = 'stop'); a
//          Settings turn-off reads as plain 'off'. phone is the auth number,
//          formatted for display — it is never editable here.
// POST   body { consentVersion } → opt in: stamps sms_alerts_opt_in_at = now and
//          the disclosure version they agreed to, and clears any opt-out.
// DELETE → opt out from Settings.
//
// The four users columns are the consent record (see the R37 migration).

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, tooManyRequests } from '@/lib/ratelimit'
import { formatPhoneForDisplay } from '@/lib/smsCopy'

type TextAlertsStatus = 'off' | 'on' | 'stopped'

function statusOf(u: {
  sms_alerts_opt_in_at: string | null
  sms_opted_out_at: string | null
  sms_opted_out_via: string | null
}): TextAlertsStatus {
  if (u.sms_opted_out_at) return u.sms_opted_out_via === 'stop' ? 'stopped' : 'off'
  return u.sms_alerts_opt_in_at ? 'on' : 'off'
}

async function read(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('phone, sms_alerts_opt_in_at, sms_opted_out_at, sms_opted_out_via')
    .eq('id', userId)
    .maybeSingle()
  if (!data) return null
  // The Mooves number, so a STOPped user can text START from one tap.
  const moovesNumber = process.env.TWILIO_PHONE_NUMBER || null
  return { status: statusOf(data), phone: formatPhoneForDisplay(data.phone), moovesNumber }
}

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await read(userId)
  if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(state)
}

export async function POST(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await checkRateLimit(`sms:optin:${userId}`, 20, 3600))) return tooManyRequests()

  let body: { consentVersion?: unknown } = {}
  try {
    body = (await req.json()) as { consentVersion?: unknown }
  } catch {
    // fall through to the validation below
  }
  const version = typeof body.consentVersion === 'string' ? body.consentVersion.trim().slice(0, 40) : ''
  if (!version) return NextResponse.json({ error: 'consentVersion is required' }, { status: 400 })

  const supabase = createServiceClient()

  // After STOP, Twilio's opt-out list blocks every send to this number until
  // the person texts START. Re-opting in here would record consent we cannot
  // act on, and every text would silently drop, so the only way back is START
  // (handled in /api/sms/inbound, which flips this row back on).
  const { data: current } = await supabase
    .from('users')
    .select('sms_opted_out_via')
    .eq('id', userId)
    .maybeSingle()
  if (current?.sms_opted_out_via === 'stop') {
    return NextResponse.json({ error: 'Text START to the Mooves number to turn these back on' }, { status: 409 })
  }

  const { error } = await supabase
    .from('users')
    .update({
      sms_alerts_opt_in_at: new Date().toISOString(),
      sms_consent_version: version,
      sms_opted_out_at: null,
      sms_opted_out_via: null,
    })
    .eq('id', userId)
  if (error) {
    console.error('text alerts opt-in failed:', error.message)
    return NextResponse.json({ error: 'Could not turn on text alerts' }, { status: 500 })
  }

  const state = await read(userId)
  return NextResponse.json(state ?? { status: 'on', phone: '' })
}

export async function DELETE(req: Request) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await checkRateLimit(`sms:optout:${userId}`, 20, 3600))) return tooManyRequests()

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ sms_opted_out_at: new Date().toISOString(), sms_opted_out_via: 'settings' })
    .eq('id', userId)
  if (error) {
    console.error('text alerts opt-out failed:', error.message)
    return NextResponse.json({ error: 'Could not turn off text alerts' }, { status: 500 })
  }

  const state = await read(userId)
  return NextResponse.json(state ?? { status: 'off', phone: '' })
}
