import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner') redirect('/dashboard')

  const { data: pendingSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'pending')

  const { data: athletes } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'athlete')

  const { data: coaches } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'coach')

  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '4px' }}>
        TAIZAN Athletics
      </h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '2rem' }}>
        Owner dashboard — The Basecamp
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: '#111', border: '0.5px solid #222', borderRadius: '12px' }}>
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Pending sessions</p>
          <p style={{ fontSize: '24px', fontWeight: '500' }}>{pendingSessions?.length ?? 0}</p>
        </div>
        <div style={{ padding: '1rem', background: '#111', border: '0.5px solid #222', borderRadius: '12px' }}>
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Athletes</p>
          <p style={{ fontSize: '24px', fontWeight: '500' }}>{athletes?.length ?? 0}</p>
        </div>
        <div style={{ padding: '1rem', background: '#111', border: '0.5px solid #222', borderRadius: '12px' }}>
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Coaches</p>
          <p style={{ fontSize: '24px', fontWeight: '500' }}>{coaches?.length ?? 0}</p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}>
          Pending sessions awaiting approval
        </h2>
        {pendingSessions?.length === 0 && (
          <p style={{ color: '#666', fontSize: '14px' }}>No pending sessions right now.</p>
        )}
        {pendingSessions?.map(session => (
          <div key={session.id} style={{
            padding: '1rem',
            background: '#111',
            border: '0.5px solid #222',
            borderRadius: '12px',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontWeight: '500', fontSize: '14px' }}>{session.title}</p>
              <p style={{ color: '#666', fontSize: '12px' }}>{session.session_type} · {new Date(session.scheduled_at).toLocaleDateString()}</p>
            </div>
            <span style={{
              background: '#1a1a00',
              color: '#fbbf24',
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '20px',
              border: '0.5px solid #333'
            }}>Pending</span>
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}>Athletes</h2>
        {athletes?.length === 0 && (
          <p style={{ color: '#666', fontSize: '14px' }}>No athletes yet.</p>
        )}
        {athletes?.map(athlete => (
          <div key={athlete.id} style={{
            padding: '1rem',
            background: '#111',
            border: '0.5px solid #222',
            borderRadius: '12px',
            marginBottom: '8px',
          }}>
            <p style={{ fontWeight: '500', fontSize: '14px' }}>{athlete.full_name ?? 'Unnamed'}</p>
            <p style={{ color: '#666', fontSize: '12px' }}>{athlete.email}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
