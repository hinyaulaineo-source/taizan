import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAthleteRole } from '@/lib/auth/roles'
import BulkBookingForm from './BulkBookingForm'

export default async function AthleteBulkBookPage() {
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
  if (!isAthleteRole(profile?.role)) redirect('/dashboard/athlete')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  if (!subscription || subscription.status !== 'active') {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/dashboard/athlete" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to athlete dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">Book sessions</h1>
        <p className="mt-2 text-sm text-zinc-500">
          You need an active subscription before booking.
        </p>
      </main>
    )
  }

  const { data: availableSessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_at, location, allowed_tiers, status, created_at')
    .eq('status', 'published')
    .order('scheduled_at', { ascending: true })

  const { data: bookings } = await supabase
    .from('bookings')
    .select('session_id, status')
    .eq('athlete_id', user.id)
    .eq('status', 'booked')

  const bookedIds = new Set((bookings ?? []).map((b) => b.session_id))
  const sessions = (availableSessions ?? [])
    .filter((s) => ((s.allowed_tiers as string[]) ?? []).includes(subscription.tier))
    .map((s) => ({
      id: s.id,
      title: s.title,
      scheduled_at: s.scheduled_at,
      location: s.location,
      isBooked: bookedIds.has(s.id),
      created_at: s.created_at,
    }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/dashboard/athlete" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to athlete dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-white">Master booking calendar</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Pick multiple sessions, then book them in one action.
      </p>
      <div className="mt-6">
        <BulkBookingForm sessions={sessions} />
      </div>
    </main>
  )
}
