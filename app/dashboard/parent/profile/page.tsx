import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessParentDashboard } from '@/lib/auth/roles'
import ChangePasswordForm from '@/components/dashboard/ChangePasswordForm'

export default async function ParentProfilePage() {
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

  if (!canAccessParentDashboard(profile?.role)) redirect('/dashboard')

  return (
    <main>
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Parent dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update your account password. Name and email are managed through your club owner if you need changes.
      </p>
      <div className="mt-8 max-w-md">
        <ChangePasswordForm variant="card" />
      </div>
    </main>
  )
}
