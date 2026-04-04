'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import DateTimeInput, { DateInput } from '@/components/ui/date-time-input'

export default function NewSessionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoBookAll, setAutoBookAll] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    session_type: 'track_session',
    scheduled_at: '',
    location: '',
    allowed_tiers: ['standard', 'performance_100m', 'performance_400m', 'elite', 'youth_standard', 'youth_elite'],
    program: '',
    recurring: false,
    recurrence_end_date: '',
    weekdays: [] as number[],
    single_tier_only: false,
    single_tier: 'standard',
    max_athletes: '',
  })

  function handleTierToggle(tier: string) {
    setForm(f => ({
      ...f,
      allowed_tiers: f.allowed_tiers.includes(tier)
        ? f.allowed_tiers.filter(t => t !== tier)
        : [...f.allowed_tiers, tier],
    }))
  }

  function handleWeekdayToggle(day: number) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(day) ? f.weekdays.filter((d) => d !== day) : [...f.weekdays, day],
    }))
  }

  async function handleSubmit() {
    if (!form.title || !form.scheduled_at) {
      setError('Please fill in title and date.')
      return
    }
    if (form.recurring && !form.recurrence_end_date) {
      setError('Please choose an end date for recurring sessions.')
      return
    }
    if (form.max_athletes && Number(form.max_athletes) <= 0) {
      setError('Assigned athletes must be at least 1.')
      return
    }
    setLoading(true)
    setError('')
    const allowedTiers = form.single_tier_only ? [form.single_tier] : form.allowed_tiers
    const maxAthletes = form.max_athletes ? Number(form.max_athletes) : null

    const endpoint = form.recurring ? '/api/sessions/recurring' : '/api/sessions'
    const payload = form.recurring
      ? {
          title: form.title,
          description: form.description,
          session_type: form.session_type,
          start_at: new Date(form.scheduled_at).toISOString(),
          end_date: form.recurrence_end_date,
          location: form.location,
          allowed_tiers: allowedTiers,
          weekdays: form.weekdays,
          program: form.program,
          max_athletes: maxAthletes,
        }
      : {
          title: form.title,
          description: form.description,
          session_type: form.session_type,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          location: form.location,
          allowed_tiers: allowedTiers,
          max_athletes: maxAthletes,
        }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Unable to save session(s).')
      setLoading(false)
      return
    }

    // For single sessions, handle program + auto-book.
    if (!form.recurring) {
      const data = (await response.json().catch(() => null)) as { id?: string } | null
      if (data?.id) {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user?.id && form.program.trim()) {
          await supabase.from('programs').insert({
            session_id: data.id,
            content_md: form.program.trim(),
            created_by: user.id,
          })
        }

        if (autoBookAll) {
          await fetch('/api/bookings/coach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: data.id, bookAllEligible: true, allowedTiers }),
          })
        }
      }
    }

    router.push('/dashboard/coach')
  }

  const inputStyle = {
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

  const labelStyle = {
    color: '#888',
    fontSize: '12px',
    display: 'block' as const,
    marginBottom: '6px',
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
        <a href="/dashboard/coach" style={{ color: '#666', fontSize: '14px', textDecoration: 'none' }}>
          ← Back
        </a>
        <h1 style={{ fontSize: '22px', fontWeight: '500' }}>New session</h1>
      </div>

      <label style={labelStyle}>Session title</label>
      <input
        style={inputStyle}
        placeholder="e.g. Speed Lab — Wednesday Track"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
      />

      <label style={labelStyle}>Session description</label>
      <textarea
        style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
        placeholder="What is this session about? e.g. Sprint technique drills focusing on acceleration phase"
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />

      <label style={labelStyle}>Session type</label>
      <select
        style={inputStyle}
        value={form.session_type}
        onChange={e => setForm(f => ({ ...f, session_type: e.target.value }))}
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
        placeholder="e.g. Main track, Field B"
        value={form.location}
        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
      />

      <div style={{ marginBottom: '16px' }}>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
            style={{ marginRight: '8px' }}
          />
          Recurring stable sessions (at least 1 month)
        </label>
      </div>

      {form.recurring && (
        <>
          <label style={labelStyle}>Recurring end date (min 28 days from start)</label>
          <div style={{ marginBottom: '16px' }}>
            <DateInput
              value={form.recurrence_end_date}
              onChange={(v) => setForm((f) => ({ ...f, recurrence_end_date: v }))}
            />
          </div>

          <label style={labelStyle}>Repeat on weekdays (optional; default = start day only)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {[
              [0, 'Sun'],
              [1, 'Mon'],
              [2, 'Tue'],
              [3, 'Wed'],
              [4, 'Thu'],
              [5, 'Fri'],
              [6, 'Sat'],
            ].map(([day, label]) => (
              <button
                key={String(day)}
                onClick={() => handleWeekdayToggle(Number(day))}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '0.5px solid #333',
                  background: form.weekdays.includes(Number(day)) ? '#fff' : '#1a1a1a',
                  color: form.weekdays.includes(Number(day)) ? '#000' : '#666',
                  fontSize: '12px',
                  fontFamily: 'var(--font-geist-mono)',
                  fontWeight: '900',
                  boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <label style={labelStyle}>Available to tiers</label>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={form.single_tier_only}
            onChange={(e) => setForm((f) => ({ ...f, single_tier_only: e.target.checked }))}
            style={{ marginRight: '8px' }}
          />
          Single subscription tier only
        </label>
      </div>
      {form.single_tier_only ? (
        <select
          style={inputStyle}
          value={form.single_tier}
          onChange={(e) => setForm((f) => ({ ...f, single_tier: e.target.value }))}
        >
          <option value="standard">standard</option>
          <option value="performance_100m">performance 100m</option>
          <option value="performance_400m">performance 400m</option>
          <option value="elite">elite</option>
          <option value="youth_standard">youth standard</option>
          <option value="youth_elite">youth elite</option>
        </select>
      ) : (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['standard', 'performance_100m', 'performance_400m', 'elite', 'youth_standard', 'youth_elite'].map(tier => (
          <button
            key={tier}
            onClick={() => handleTierToggle(tier)}
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
      )}

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
        placeholder="Warm up: 10 min jog&#10;Drills: A-skip, B-skip&#10;Main set: 4x100m..."
        value={form.program}
        onChange={e => setForm(f => ({ ...f, program: e.target.value }))}
      />

      <div style={{ marginBottom: '16px' }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={autoBookAll}
            onChange={(e) => setAutoBookAll(e.target.checked)}
          />
          Auto-book all eligible athletes after creation
        </label>
        <p style={{ color: '#666', fontSize: '11px', marginTop: '4px', marginLeft: '22px' }}>
          Books every athlete whose subscription tier matches this session.
        </p>
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
      )}

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
          fontFamily: 'var(--font-geist-mono)',
          fontWeight: '900',
          boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Submitting...' : form.recurring ? 'Create recurring sessions' : 'Submit for approval'}
      </button>
    </main>
  )
}
