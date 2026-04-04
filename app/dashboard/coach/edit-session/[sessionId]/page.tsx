import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditSessionForm from './EditSessionForm'
import Link from 'next/link'

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

  if (profile?.role !== 'coach' && profile?.role !== 'owner') redirect('/dashboard')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, description, session_type, scheduled_at, location, allowed_tiers, max_athletes, status, created_by, created_at')
    .eq('id', sessionId)
    .single()

  if (!session) redirect('/dashboard/coach')

  // Let coach edit their own sessions (RLS should enforce, but UI should be clear)
  if (profile?.role === 'coach' && session.created_by !== user.id) redirect('/dashboard/coach')

  const { data: program } = await supabase
    .from('programs')
    .select('content_md')
    .eq('session_id', sessionId)
    .maybeSingle()

  let batchSessionIds: string[] = [session.id]
  if (batch === '1') {
    const { data: batchSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('created_by', session.created_by)
      .eq('created_at', session.created_at)
    if (batchSessions && batchSessions.length > 0) {
      batchSessionIds = batchSessions.map((s) => s.id)
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
        <Link href="/dashboard/coach" style={{ color: '#888', fontSize: '14px', textDecoration: 'none' }}>
          ← Back
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: '500' }}>Edit session</h1>
      </div>

      <EditSessionForm
        sessionId={session.id}
        batchSessionIds={batchSessionIds}
        initial={{
          id: session.id,
          title: session.title ?? '',
          description: (session as any).description ?? '',
          session_type: session.session_type ?? 'track_session',
          scheduled_at: session.scheduled_at ? new Date(session.scheduled_at).toISOString().slice(0, 16) : '',
          location: session.location ?? '',
          allowed_tiers: (session.allowed_tiers ?? []) as string[],
          program: (program as any)?.content_md ?? '',
          max_athletes: session.max_athletes,
          created_at: session.created_at,
          created_by: session.created_by,
        }}
        initialApplyToBatch={batch === '1'}
      />
    </main>
  )
}

