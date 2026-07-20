// POST /api/sponsor/billing/payment-method — after the browser confirms the
// SetupIntent, save the resulting payment method as the customer's default and
// charge any approved-but-unpaid moves. Sponsor-gated.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSponsor } from '@/lib/sponsor'
import { stripe } from '@/lib/stripe'
import { chargePendingForSponsor } from '@/lib/billing'

export async function POST(req: Request) {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentMethodId } = (await req.json()) as { paymentMethodId?: string }
  if (!paymentMethodId) return NextResponse.json({ error: 'paymentMethodId required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('stripe_customer_id')
    .eq('id', sponsorId)
    .single()
  if (!sponsor?.stripe_customer_id) return NextResponse.json({ error: 'No customer' }, { status: 400 })

  // The SetupIntent already attached the PM to the customer; set it as default.
  try {
    await stripe.customers.update(sponsor.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })
  } catch {
    return NextResponse.json({ error: 'Could not save card' }, { status: 500 })
  }

  await supabase.from('sponsors').update({ default_payment_method_id: paymentMethodId }).eq('id', sponsorId)

  // Now that a card is on file, charge any approved-but-unpaid moves → live.
  await chargePendingForSponsor(sponsorId)

  return NextResponse.json({ ok: true })
}
