import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import EditSessionForm from './EditSessionForm'
import Link from 'next/link'
import { toHkDateTimeInputValue } from '@/lib/hk-date'

interface PageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ batch?: string }>
}

export default async function EditSessionPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params
  const { batch } = await searchParams

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

  if (profile?.role !== 'coach' && !isOwnerLike(profile?.role)) redirect('/dashboard')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, description, session_type, scheduled_at, location, allowed_tiers, max_athletes, status, created_by, created_at')
    .eq('id', sessionId)
    .single()

  if (!session) redirect('/dashboard/coach')

  if (!isOwnerLike(profile?.role) && session.created_by !== user.id) redirect('/dashboard/coach')

  const { data: program } = await supabase
    .from('programs')
    .select('content_md')
    .eq('session_id', sessionId)
    .maybeSingle()

  const { data: batchSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('created_by', session.created_by)
    .eq('created_at', session.created_at)

  const batchSessionIds =
    batchSessions && batchSessions.length > 0 ? batchSessions.map((s) => s.id) : [session.id]

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
        <Link href="/dashboard/coach" style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}>
          ← Back
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: '500' }}>
          {batch === '1' || batchSessionIds.length > 1 ? 'Edit session batch' : 'Edit session'}
        </h1>
      </div>

      <EditSessionForm
        sessionId={session.id}
        batchSessionIds={batchSessionIds}
        initial={{
          id: session.id,
          title: session.title ?? '',
          description: (session as { description?: string | null }).description ?? '',
          session_type: session.session_type ?? 'track_session',
          scheduled_at: session.scheduled_at ? toHkDateTimeInputValue(session.scheduled_at) : '',
          location: session.location ?? '',
          allowed_tiers: (session.allowed_tiers ?? []) as string[],
          program: (program as { content_md?: string } | null)?.content_md ?? '',
          max_athletes: session.max_athletes,
          created_at: session.created_at,
          created_by: session.created_by,
        }}
        initialApplyToBatch={batch === '1' && batchSessionIds.length > 1}
      />
    </main>
  )
}
