import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import AthleteProfileForm from '@/app/dashboard/athlete/profile/AthleteProfileForm'

export default async function CoachEditAthletePage({
  params,
}: {
  params: Promise<{ athleteId: string }>
}) {
  const { athleteId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (coachProfile?.role !== 'coach' && !isOwnerLike(coachProfile?.role)) {
    redirect('/dashboard/coach')
  }

  const { data: athlete } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url, main_events, primary_coach_id, email, phone')
    .eq('id', athleteId)
    .maybeSingle()

  if (!athlete || athlete.role !== 'athlete') notFound()

  const isCoach = coachProfile?.role === 'coach'
  if (isCoach && athlete.primary_coach_id !== user.id) {
    redirect('/dashboard/coach')
  }

  return (
    <main>
      <Link
        href="/dashboard/coach"
        className="text-sm text-muted-foreground transition hover:text-foreground"
      >
        ← Coach dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Athlete profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {athlete.full_name ?? 'Unnamed'} ({athlete.email})
      </p>
      <div className="mt-8">
        <AthleteProfileForm
          initialFullName={athlete.full_name ?? null}
          initialAvatarUrl={athlete.avatar_url ?? null}
          initialPhone={athlete.phone ?? null}
          initialMainEvents={(athlete.main_events as string[] | null) ?? []}
          patchPath={`/api/coach/athletes/${athleteId}`}
        />
      </div>
    </main>
  )
}
