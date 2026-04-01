'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DateTimeInput from '@/components/ui/date-time-input'

export default function EditSessionForm({
  sessionId,
  initial,
}: {
  sessionId: string
  initial: {
    title: string
    session_type: string
    scheduled_at: string
    location: string
    allowed_tiers: string[]
    program: string
    max_athletes?: number | null
  }
}) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: initial.title,
    session_type: initial.session_type,
    scheduled_at: initial.scheduled_at,
    location: initial.location,
    allowed_tiers: initial.allowed_tiers,
    program: initial.program,
    max_athletes: initial.max_athletes ? String(initial.max_athletes) : '',
  })

  function handleTierToggle(tier: string) {
    setForm((f) => ({
      ...f,
      allowed_tiers: f.allowed_tiers.includes(tier) ? f.allowed_tiers.filter((t) => t !== tier) : [...f.allowed_tiers, tier],
    }))
  }

  async function handleSubmit() {
    if (!form.title || !form.scheduled_at) {
      setError('Please fill in title and date.')
      return
    }
    if (form.max_athletes && Number(form.max_athletes) <= 0) {
      setError('Assigned athletes must be at least 1.')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const iso = new Date(form.scheduled_at).toISOString()

    const { error: sessionError } = await supabase.from('sessions').update({
      title: form.title,
      session_type: form.session_type,
      scheduled_at: iso,
      location: form.location,
      allowed_tiers: form.allowed_tiers,
      max_athletes: form.max_athletes ? Number(form.max_athletes) : null,
    }).eq('id', sessionId)

    if (sessionError) {
      setError(sessionError.message)
      setLoading(false)
      return
    }

    // Update or insert program if provided
    if (form.program.trim().length > 0) {
      const { data: existingProgram } = await supabase
        .from('programs')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (existingProgram?.id) {
        const { error: programError } = await supabase
          .from('programs')
          .update({ content_md: form.program, updated_at: new Date().toISOString() })
          .eq('id', existingProgram.id)
        if (programError) {
          setError(programError.message)
          setLoading(false)
          return
        }
      } else {
        const { error: programError } = await supabase.from('programs').insert({
          session_id: sessionId,
          content_md: form.program,
          created_by: user.id,
        })
        if (programError) {
          setError(programError.message)
          setLoading(false)
          return
        }
      }
    }

    router.push('/dashboard/coach')
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#1a1a1a',
    border: '0.5px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    marginBottom: '16px',
  }

  const labelStyle: React.CSSProperties = {
    color: '#888',
    fontSize: '12px',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <div>
      <label style={labelStyle}>Session title</label>
      <input
        style={inputStyle}
        placeholder="Session title"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />

      <label style={labelStyle}>Session type</label>
      <select
        style={inputStyle}
        value={form.session_type}
        onChange={(e) => setForm((f) => ({ ...f, session_type: e.target.value }))}
      >
        <option value="track_session">Track session</option>
        <option value="gym_session">Gym session</option>
        <option value="recovery">Recovery</option>
        <option value="strength">Strength</option>
      </select>

      <label style={labelStyle}>Date and time</label>
      <div style={{ marginBottom: '16px' }}>
        <DateTimeInput
          value={form.scheduled_at}
          onChange={(v) => setForm((f) => ({ ...f, scheduled_at: v }))}
        />
      </div>

      <label style={labelStyle}>Location</label>
      <input
        style={inputStyle}
        placeholder="Location"
        value={form.location}
        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
      />

      <label style={labelStyle}>Available to tiers</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['standard', 'performance', 'elite', 'youth_standard', 'youth_elite'].map((tier) => (
          <button
            key={tier}
            onClick={() => handleTierToggle(tier)}
            type="button"
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '0.5px solid #333',
              background: form.allowed_tiers.includes(tier) ? '#fff' : '#1a1a1a',
              color: form.allowed_tiers.includes(tier) ? '#000' : '#666',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: form.allowed_tiers.includes(tier) ? '500' : '400',
            }}
          >
            {tier}
          </button>
        ))}
      </div>

      <label style={labelStyle}>How many athletes can be assigned (optional)</label>
      <input
        type="number"
        min={1}
        style={inputStyle}
        placeholder="e.g. 20"
        value={form.max_athletes}
        onChange={(e) => setForm((f) => ({ ...f, max_athletes: e.target.value }))}
      />

      <label style={labelStyle}>Pre-session program / notes</label>
      <textarea
        style={{ ...inputStyle, minHeight: '160px', resize: 'vertical' }}
        placeholder="Warm up: 10 min..."
        value={form.program}
        onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))}
      />

      {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%',
          padding: '11px',
          background: '#fff',
          color: '#000',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  )
}

