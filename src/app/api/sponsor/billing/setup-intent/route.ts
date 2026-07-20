// POST /api/sponsor/billing/setup-intent — ensure a Stripe Customer exists for
// the sponsor and return a SetupIntent client_secret so the browser can collect
// + save a card via Stripe Elements. Sponsor-gated.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSponsor } from '@/lib/sponsor'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('stripe_customer_id, phone, business_name')
    .eq('id', sponsorId)
    .single()
  if (!sponsor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let customerId = sponsor.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: sponsor.business_name ?? undefined,
      phone: sponsor.phone,
      metadata: { sponsor_id: sponsorId },
    })
    customerId = customer.id
    await supabase.from('sponsors').update({ stripe_customer_id: customerId }).eq('id', sponsorId)
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    payment_method_types: ['card'],
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret })
}
