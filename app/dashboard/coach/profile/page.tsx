import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import ChangePasswordForm from '@/components/dashboard/ChangePasswordForm'
import AthleteProfileForm from '@/app/dashboard/athlete/profile/AthleteProfileForm'

export default async function CoachProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, phone')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'
  if (!isCoach && !isOwnerLike(profile?.role)) redirect('/dashboard/coach')

  return (
    <main>
      <Link
        href="/dashboard/coach"
        className="text-sm text-muted-foreground transition hover:text-foreground"
      >
        ← Coach dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update how your name and photo appear in the app. Email is managed in Supabase Auth.
      </p>
      <div className="mt-8 space-y-8">
        <AthleteProfileForm
          initialFullName={profile?.full_name ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
          initialPhone={profile?.phone ?? null}
          initialMainEvents={[]}
          hideMainEvents
        />
        <ChangePasswordForm variant="card" />
      </div>
    </main>
  )
}
