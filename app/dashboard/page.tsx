import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, coach_request_pending')
    .eq('id', user.id)
    .single()

  let ensuredProfile = profile

  // First-login fallback: if profile row is missing, create one.
  if (!ensuredProfile) {
    const desiredRole = String(user.user_metadata?.desired_role ?? '').toLowerCase()
    const shouldBeParent = desiredRole === 'parent'
    const coachRequested = desiredRole === 'coach'
    const { data: created } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? '',
          full_name:
            (user.user_metadata?.full_name as string | undefined) ??
            (user.email?.split('@')[0] ?? ''),
          role: shouldBeParent ? 'parent' : 'athlete',
          coach_request_pending: coachRequested,
          coach_requested_at: coachRequested ? new Date().toISOString() : null,
        },
        { onConflict: 'id' }
      )
      .select('role, full_name, coach_request_pending')
      .single()

    ensuredProfile = created ?? null
  }

  const roleRaw = ensuredProfile?.role
  const role = normalizeRole(roleRaw)

  if (role === 'owner') redirect('/dashboard/admin')
  if (role === 'coach') redirect('/dashboard/coach')
  if (role === 'parent') redirect('/dashboard/parent')

  redirect('/dashboard/athlete')
}
