import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isOwnerLike, isParentRole } from '@/lib/auth/roles'
import ParentBookingButton from './ParentBookingButton'

interface PageProps {
  params: Promise<{ athleteId: string; sessionId: string }>
}

export default async function ParentBookSessionPage({ params }: PageProps) {
  const { athleteId, sessionId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const previewOnly = isOwnerLike(profile?.role) && !isParentRole(profile?.role)
  if (!isParentRole(profile?.role) && !previewOnly) redirect('/dashboard')

  if (!previewOnly) {
    const { data: link } = await supabase
      .from('parent_athlete_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('athlete_id', athleteId)
      .single()

    if (!link) redirect('/dashboard/parent')
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', athleteId)
    .single()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, session_type, location, scheduled_at, status, allowed_tiers, programs(*)')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'published') redirect('/dashboard/parent')

  const allowedTiers = ((session.allowed_tiers ?? []) as string[]) ?? []
  const active = subscription?.status === 'active'
  const eligible = active && allowedTiers.includes(subscription?.tier)

  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('status')
    .eq('athlete_id', athleteId)
    .eq('session_id', sessionId)
    .maybeSingle()

  const alreadyBooked = existingBooking?.status === 'booked'

  return (
    <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <Link
        href="/dashboard/parent"
        style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}
      >
        ← Back to parent dashboard
      </Link>

      <h1 style={{ fontSize: '22px', fontWeight: '500', marginTop: '12px', marginBottom: '4px' }}>
        Confirm Booking for Athlete
      </h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '2rem' }}>Review the session details.</p>

      <div
        style={{
          padding: '1rem',
          background: '#111',
          border: '0.5px solid #222',
          borderRadius: '12px',
          marginBottom: '1rem',
        }}
      >
        <p style={{ fontWeight: '500', fontSize: '15px', marginBottom: '6px' }}>{session.title}</p>
        <p style={{ color: '#888', fontSize: '13px' }}>
          {session.session_type} · {new Date(session.scheduled_at).toLocaleString()} · {session.location}
        </p>

        {(session.programs as any)?.content_md && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              background: '#0a0a0a',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#888',
              whiteSpace: 'pre-wrap',
            }}
          >
            {(session.programs as any).content_md}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '1rem',
          background: '#111',
          border: '0.5px solid #222',
          borderRadius: '12px',
          marginBottom: '1.2rem',
        }}
      >
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Athlete subscription</p>
        <p style={{ fontSize: '14px', color: eligible ? '#4ade80' : '#f87171' }}>
          {subscription ? `${subscription.tier} (${subscription.status})` : 'No subscription found'}
        </p>
      </div>

      {alreadyBooked && (
        <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
          This athlete already booked this session.
        </p>
      )}

      {!eligible && !alreadyBooked && (
        <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
          This athlete cannot book this session (inactive subscription or tier mismatch).
        </p>
      )}

      <ParentBookingButton
        athleteId={athleteId}
        sessionId={session.id}
        disabled={previewOnly || !eligible || alreadyBooked}
        alreadyBooked={alreadyBooked}
        previewOnly={previewOnly}
      />
    </main>
  )
}

