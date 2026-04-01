import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAthleteRole } from '@/lib/auth/roles'
import AthleteProfileForm from './AthleteProfileForm'

export default async function AthleteProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!isAthleteRole(profile?.role)) redirect('/dashboard/athlete')

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
      <div className="mt-8">
        <AthleteProfileForm
          initialFullName={profile?.full_name ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
      </div>
    </main>
  )
}
