import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAthleteRole, isOwnerLike } from '@/lib/auth/roles'
import BookingButton from './BookingButton'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default async function BookSessionPage({ params }: PageProps) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const previewOnly = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)
  if (!isAthleteRole(profile?.role) && !previewOnly) redirect('/dashboard')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, session_type, location, scheduled_at, status, allowed_tiers, programs(*)')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'published') redirect('/dashboard/athlete')

  const tier = subscription?.tier
  const active = subscription?.status === 'active'
  const allowed = active && !!tier && ((session.allowed_tiers as string[]) ?? []).includes(tier)

  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('status')
    .eq('athlete_id', user.id)
    .eq('session_id', session.id)
    .maybeSingle()

  const alreadyBooked = existingBooking?.status === 'booked'

  return (
    <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/dashboard/athlete" style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}>
        ← Back to athlete dashboard
      </Link>

      <h1 style={{ fontSize: '22px', fontWeight: '500', marginTop: '12px', marginBottom: '4px' }}>
        Confirm Booking
      </h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '2rem' }}>
        Review the details before booking your spot.
      </p>

      <div style={{ padding: '1rem', background: '#111', border: '0.5px solid #222', borderRadius: '12px', marginBottom: '1rem' }}>
        <p style={{ fontWeight: '500', fontSize: '15px', marginBottom: '6px' }}>{session.title}</p>
        <p style={{ color: '#888', fontSize: '13px' }}>
          {session.session_type} · {new Date(session.scheduled_at).toLocaleString()} · {session.location}
        </p>
        {(session.programs as any)?.content_md && (
          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#0a0a0a', borderRadius: '10px', fontSize: '12px', color: '#888', whiteSpace: 'pre-wrap' }}>
            {(session.programs as any).content_md}
          </div>
        )}
      </div>

      <div style={{ padding: '1rem', background: '#111', border: '0.5px solid #222', borderRadius: '12px', marginBottom: '1.2rem' }}>
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Your subscription</p>
        <p style={{ fontSize: '14px', color: active ? '#4ade80' : '#f87171' }}>
          {subscription ? `${subscription.tier} (${subscription.status})` : 'No subscription found'}
        </p>
      </div>

      {!allowed && (
        <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
          You cannot book this session. Make sure your subscription is active and tier-eligible.
        </p>
      )}

      <BookingButton
        sessionId={session.id}
        disabled={!allowed || alreadyBooked}
        alreadyBooked={alreadyBooked}
        previewOnly={previewOnly}
      />
    </main>
  )
}
