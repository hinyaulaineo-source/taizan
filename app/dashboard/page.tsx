import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  if (role === 'owner') redirect('/dashboard/admin')
  if (role === 'coach') redirect('/dashboard/coach')
  if (role === 'parent') redirect('/dashboard/parent')

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>
        Welcome back, {profile?.full_name ?? user.email}
      </h1>
      <p style={{ color: '#888', fontSize: '14px' }}>Fall 7, get up 8.</p>
    </main>
  )
}
