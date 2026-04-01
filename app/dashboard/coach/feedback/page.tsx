import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import FeedbackForm from './FeedbackForm'

export default async function CoachFeedbackPage() {
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

  if (!profile || (profile.role !== 'coach' && !isOwnerLike(profile.role))) redirect('/dashboard')

  const { data: athletes } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'athlete')
    .order('full_name', { ascending: true })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_at')
    .eq('created_by', user.id)
    .order('scheduled_at', { ascending: false })
    .limit(30)

  return (
    <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/dashboard/coach" style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}>
        ← Back to coach dashboard
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginTop: '12px', marginBottom: '6px' }}>
        Add athlete feedback
      </h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '1.2rem' }}>
        Save daily or weekly feedback for athlete progress tracking.
      </p>

      <FeedbackForm athletes={athletes ?? []} sessions={sessions ?? []} />
    </main>
  )
}
