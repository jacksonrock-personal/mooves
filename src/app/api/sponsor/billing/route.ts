// GET    /api/sponsor/billing — the sponsor's card on file (brand/last4/exp)
// DELETE /api/sponsor/billing — remove the saved card
// Sponsor-gated.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSponsor } from '@/lib/sponsor'
import { stripe, PLACEMENT_PRICE_CENTS } from '@/lib/stripe'

export async function GET() {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('stripe_customer_id, default_payment_method_id')
    .eq('id', sponsorId)
    .single()

  if (!sponsor?.default_payment_method_id) {
    return NextResponse.json({ hasCard: false, placementPriceCents: PLACEMENT_PRICE_CENTS })
  }

  try {
    const pm = await stripe.paymentMethods.retrieve(sponsor.default_payment_method_id)
    return NextResponse.json({
      hasCard: true,
      placementPriceCents: PLACEMENT_PRICE_CENTS,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    })
  } catch {
    return NextResponse.json({ hasCard: false, placementPriceCents: PLACEMENT_PRICE_CENTS })
  }
}

export async function DELETE() {
  const sponsorId = await requireSponsor()
  if (!sponsorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('default_payment_method_id')
    .eq('id', sponsorId)
    .single()

  if (sponsor?.default_payment_method_id) {
    try {
      await stripe.paymentMethods.detach(sponsor.default_payment_method_id)
    } catch {
      // already detached / unknown — proceed to clear our reference
    }
  }
  await supabase.from('sponsors').update({ default_payment_method_id: null }).eq('id', sponsorId)
  return NextResponse.json({ ok: true })
}
