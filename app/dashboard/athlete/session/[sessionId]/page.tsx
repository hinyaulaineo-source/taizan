import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAthleteDashboard, isAthleteRole, isOwnerLike } from '@/lib/auth/roles'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatHkDateTime } from '@/lib/hk-date'
import CancelBookingButton from './CancelBookingButton'
import SelfCheckInButton from './SelfCheckInButton'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default async function AthleteSessionDetailsPage({ params }: PageProps) {
  const { sessionId } = await params
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

  if (!canAccessAthleteDashboard(profile?.role)) redirect('/dashboard')

  const ownerAccess = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)

  const { data: booking } = await supabase
    .from('bookings')
    .select('status, booked_at')
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, description, session_type, location, scheduled_at, max_athletes, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) redirect('/dashboard/athlete')
  if (!ownerAccess && !booking) redirect('/dashboard/athlete')
  if (!ownerAccess && session.status !== 'published' && booking?.status !== 'booked') {
    redirect('/dashboard/athlete')
  }

  const { data: programRow } = await supabase
    .from('programs')
    .select('content_md')
    .eq('session_id', sessionId)
    .maybeSingle()

  const description = (session.description ?? '').trim()
  const programNotes = (programRow?.content_md ?? '').trim()
  const aboutText = [description, programNotes].filter(Boolean).join('\n\n')

  const isBooked = booking?.status === 'booked'
  const statusTone = isBooked ? 'success' : 'neutral'
  const statusLabel = isBooked ? 'booked' : ownerAccess ? 'owner view' : booking?.status ?? 'available'

  const { data: attendance } = await supabase
    .from('attendance')
    .select('checked_in')
    .eq('session_id', sessionId)
    .eq('athlete_id', user.id)
    .maybeSingle()

  const selfCheckedIn: boolean | null = attendance ? attendance.checked_in : null

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/dashboard/athlete" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to athlete dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Session details</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ownerAccess
          ? 'Owner access: view any session and use check-in.'
          : 'View full information for your booked session.'}
      </p>

      {ownerAccess && (
        <p className="mt-3 rounded-lg border border-amber-900/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Owner view is unlocked — you can open every session and check in.
        </p>
      )}

      <Card className="mt-6 overflow-visible">
        <CardContent className="space-y-4 overflow-visible">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{session.title}</h2>
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              About this session
            </p>
            {aboutText ? (
              <div className="space-y-4">
                {description ? (
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">Description</p>
                    <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {description}
                    </p>
                  </div>
                ) : null}
                {programNotes ? (
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">Program / notes</p>
                    <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {programNotes}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No description or program notes yet.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Session type</p>
              <p className="mt-1 break-words text-sm text-foreground">{session.session_type}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Scheduled</p>
              <p className="mt-1 break-words text-sm text-foreground">
                {formatHkDateTime(session.scheduled_at)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="mt-1 break-words text-sm text-foreground">{session.location || 'TBD'}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="mt-1 break-words text-sm text-foreground">
                {session.max_athletes ? `${session.max_athletes} athletes` : 'Not limited'}
              </p>
            </div>
          </div>

          {booking?.booked_at ? (
            <p className="text-xs text-muted-foreground">
              Booked on: {formatHkDateTime(booking.booked_at)}
            </p>
          ) : null}

          {(isBooked || ownerAccess) && (
            <SelfCheckInButton sessionId={session.id} initialCheckedIn={selfCheckedIn} />
          )}
          {isBooked ? <CancelBookingButton sessionId={session.id} /> : null}
          {!isBooked && ownerAccess ? (
            <Link
              href={`/dashboard/athlete/book/${session.id}`}
              className="inline-flex rounded-md bg-white px-4 py-2 text-sm font-black text-black hover:bg-zinc-200"
            >
              Book this session
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
