import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfileRowWithOptionalPrimaryCoach } from '@/lib/supabase/profile-row'
import { isAthleteRole } from '@/lib/auth/roles'
import AthleteProfileForm from './AthleteProfileForm'

export default async function AthleteProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getProfileRowWithOptionalPrimaryCoach(supabase, user.id)

  if (!isAthleteRole(profile?.role)) redirect('/dashboard/athlete')

  const { data: primaryCoachProfile } = profile?.primary_coach_id
    ? await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', profile.primary_coach_id)
        .maybeSingle()
    : { data: null as { full_name: string | null; email: string } | null }

  return (
    <main>
      <Link
        href="/dashboard/athlete"
        className="text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        ← Athlete dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">My profile</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your name and photo appear in the app header and dashboard. One profile photo at a time
        (URL or upload).
      </p>
      {primaryCoachProfile ? (
        <p className="mt-3 text-sm text-zinc-400">
          <span className="font-medium text-zinc-300">Your coach: </span>
          {primaryCoachProfile.full_name?.trim()
            ? primaryCoachProfile.full_name
            : primaryCoachProfile.email}
        </p>
      ) : null}
      <div className="mt-8">
        <AthleteProfileForm
          initialFullName={profile?.full_name ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
          initialMainEvents={(profile?.main_events as string[] | null) ?? []}
        />
      </div>
    </main>
  )
}
