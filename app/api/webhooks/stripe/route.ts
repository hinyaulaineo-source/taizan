import { SUBSCRIPTION_TIERS } from '@/lib/security/validation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

export const runtime = 'nodejs'

const tierSchema = z.enum(SUBSCRIPTION_TIERS)

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function tierFromMetadata(meta: Stripe.Metadata | null | undefined): z.infer<typeof tierSchema> | null {
  const raw = meta?.subscription_tier ?? meta?.tier
  const p = tierSchema.safeParse(raw)
  return p.success ? p.data : null
}

/**
 * Stripe webhook — sync `public.subscriptions` from Checkout + Subscription events.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !whSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 })
  }

  const admin = adminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const stripe = new Stripe(secret)
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, whSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid payload'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const userId = session.metadata?.supabase_user_id ?? session.client_reference_id
        const tier = tierFromMetadata(session.metadata)
        if (!userId || !tier) break

        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

        await admin.from('subscriptions').upsert(
          {
            user_id: userId,
            tier,
            status: 'active',
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subId ?? null,
            ends_at: null,
          },
          { onConflict: 'user_id' },
        )
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break

        const metaTier = tierFromMetadata(sub.metadata)
        const { data: existing } = await admin
          .from('subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .maybeSingle()
        const tier = metaTier ?? existing?.tier ?? 'standard'

        const active = sub.status === 'active' || sub.status === 'trialing'
        await admin.from('subscriptions').upsert(
          {
            user_id: userId,
            tier,
            status: active ? 'active' : 'inactive',
            stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
            stripe_subscription_id: sub.id,
            ends_at: active
              ? null
              : new Date(
                  (sub.canceled_at ?? sub.cancel_at ?? Math.floor(Date.now() / 1000)) * 1000,
                ).toISOString(),
          },
          { onConflict: 'user_id' },
        )
        break
      }
      default:
        break
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'handler error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
