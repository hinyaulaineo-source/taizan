import { createClient } from '@/lib/supabase/server'
import { parseBody, stripeCheckoutSchema } from '@/lib/security/validation'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function stripePriceAllowlist(): Set<string> {
  const raw = process.env.STRIPE_PRICE_ALLOWLIST ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

/**
 * Starts Stripe Checkout for the signed-in user (subscription mode).
 * Env: STRIPE_SECRET_KEY, STRIPE_PRICE_ALLOWLIST, NEXT_PUBLIC_SITE_URL
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })
  }

  const json = await request.json().catch(() => null)
  const parsed = parseBody(stripeCheckoutSchema, json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { tier, priceId } = parsed.data

  const allow = stripePriceAllowlist()
  if (!allow.has(priceId)) {
    return NextResponse.json({ error: 'Invalid price selection.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  const stripe = new Stripe(secret)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${site}/dashboard?billing=success`,
    cancel_url: `${site}/dashboard?billing=cancel`,
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      subscription_tier: tier,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        subscription_tier: tier,
      },
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
