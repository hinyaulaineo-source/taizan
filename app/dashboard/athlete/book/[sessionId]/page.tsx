import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAthleteRole, isOwnerLike } from '@/lib/auth/roles'
import BookingButton from './BookingButton'
import { effectiveQuota } from '@/lib/session-quota'

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

  const ownerAccess = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)
  if (!isAthleteRole(profile?.role) && !ownerAccess) redirect('/dashboard')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status, monthly_session_allowance, sessions_remaining, quota_month')
    .eq('user_id', user.id)
    .single()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, description, session_type, location, scheduled_at, status, allowed_tiers')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'published') redirect('/dashboard/athlete')

  const { data: programRow } = await supabase
    .from('programs')
    .select('content_md')
    .eq('session_id', sessionId)
    .maybeSingle()

  const description = (session.description ?? '').trim()
  const programNotes = (programRow?.content_md ?? '').trim()

  const tier = subscription?.tier
  const active = subscription?.status === 'active'
  const allowed =
    ownerAccess || (active && !!tier && ((session.allowed_tiers as string[]) ?? []).includes(tier))

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
        {(description || programNotes) && (
          <div style={{ marginTop: '12px', padding: '10px 12px', background: '#0a0a0a', borderRadius: '10px' }}>
            <p style={{ color: '#666', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              About this session
            </p>
            {description ? (
              <p style={{ fontSize: '13px', color: '#ddd', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: programNotes ? '12px' : 0 }}>
                {description}
              </p>
            ) : null}
            {programNotes ? (
              <>
                <p style={{ color: '#666', fontSize: '11px', marginBottom: '6px' }}>Program / notes</p>
                <p style={{ fontSize: '13px', color: '#ddd', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {programNotes}
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>

      <div style={{ padding: '1rem', background: '#111', border: '0.5px solid #222', borderRadius: '12px', marginBottom: '1.2rem' }}>
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Your subscription</p>
        <p style={{ fontSize: '14px', color: active ? '#4ade80' : '#f87171' }}>
          {subscription ? `${subscription.tier} (${subscription.status})` : 'No subscription found'}
        </p>
        {active && subscription ? (
          <p style={{ fontSize: '13px', color: '#888', marginTop: '6px' }}>
            {effectiveQuota(subscription).remaining} of {effectiveQuota(subscription).allowance} sessions
            left this month
          </p>
        ) : null}
      </div>

      {ownerAccess && (
        <p style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '12px' }}>
          Owner access: booking is unlocked without subscription limits.
        </p>
      )}
      {!allowed && (
        <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
          You cannot book this session. Make sure your subscription is active and tier-eligible.
        </p>
      )}
      {allowed && !ownerAccess && !alreadyBooked && effectiveQuota(subscription).remaining <= 0 && (
        <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
          You have no monthly sessions left. Ask your coach or club owner if you need more this month.
        </p>
      )}

      <BookingButton
        sessionId={session.id}
        disabled={
          !allowed ||
          alreadyBooked ||
          (!ownerAccess && active && effectiveQuota(subscription).remaining <= 0)
        }
        alreadyBooked={alreadyBooked}
      />
    </main>
  )
}
