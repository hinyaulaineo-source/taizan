'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DateTimeInput, { DateInput } from '@/components/ui/date-time-input'
import SessionAthleteBooker from '@/components/coach/SessionAthleteBooker'
import { applyHkTimeToIso, hkDateTimeInputToIso } from '@/lib/hk-date'

export default function EditSessionForm({
  sessionId,
  batchSessionIds,
  initial,
  initialApplyToBatch = false,
}: {
  sessionId: string
  batchSessionIds: string[]
  initialApplyToBatch?: boolean
  initial: {
    id: string
    title: string
    description: string
    session_type: string
    scheduled_at: string
    location: string
    allowed_tiers: string[]
    program: string
    max_athletes?: number | null
    created_at: string
    created_by: string
  }
}) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [applyToBatch, setApplyToBatch] = useState(initialApplyToBatch)
  const [form, setForm] = useState({
    title: initial.title,
    description: initial.description,
    session_type: initial.session_type,
    scheduled_at: initial.scheduled_at,
    location: initial.location,
    allowed_tiers: initial.allowed_tiers,
    program: initial.program,
    max_athletes: initial.max_athletes ? String(initial.max_athletes) : '',
    single_tier_only: initial.allowed_tiers.length === 1,
    single_tier: initial.allowed_tiers[0] ?? 'standard',
    recurring: false,
    recurrence_end_date: '',
    weekdays: [] as number[],
  })

  function handleTierToggle(tier: string) {
    setForm((f) => ({
      ...f,
      allowed_tiers: f.allowed_tiers.includes(tier) ? f.allowed_tiers.filter((t) => t !== tier) : [...f.allowed_tiers, tier],
    }))
  }

  function handleWeekdayToggle(day: number) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(day) ? f.weekdays.filter((d) => d !== day) : [...f.weekdays, day],
    }))
  }

  async function upsertProgram(targetSessionId: string, content: string, userId: string) {
    const { data: existingProgram } = await supabase
      .from('programs')
      .select('id')
      .eq('session_id', targetSessionId)
      .maybeSingle()

    if (existingProgram?.id) {
      return supabase
        .from('programs')
        .update({ content_md: content, updated_at: new Date().toISOString() })
        .eq('id', existingProgram.id)
    }

    return supabase.from('programs').insert({
      session_id: targetSessionId,
      content_md: content,
      created_by: userId,
    })
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

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      let iso: string
      try {
        iso = hkDateTimeInputToIso(form.scheduled_at)
      } catch {
        setError('Please choose a valid date and time.')
        setLoading(false)
        return
      }

      const allowedTiers = form.single_tier_only ? [form.single_tier] : form.allowed_tiers
      const baseUpdates = {
        title: form.title,
        description: form.description,
        session_type: form.session_type,
        location: form.location,
        allowed_tiers: allowedTiers,
        max_athletes: form.max_athletes ? Number(form.max_athletes) : null,
      }

      const targetIds =
        applyToBatch && batchSessionIds.length > 0 ? Array.from(new Set(batchSessionIds)) : [sessionId]

      if (applyToBatch && targetIds.length > 1) {
        const { data: updatedRows, error: sessionError } = await supabase
          .from('sessions')
          .update(baseUpdates)
          .in('id', targetIds)
          .select('id, scheduled_at')

        if (sessionError) {
          setError(sessionError.message)
          setLoading(false)
          return
        }
        if (!updatedRows || updatedRows.length === 0) {
          setError('Save failed — no sessions were updated. Check your permissions and try again.')
          setLoading(false)
          return
        }

        // Keep each session's HK calendar date; apply the edited clock time to all.
        if (form.scheduled_at !== initial.scheduled_at) {
          for (const row of updatedRows) {
            const nextIso = applyHkTimeToIso(row.scheduled_at, form.scheduled_at)
            const { error: timeError } = await supabase
              .from('sessions')
              .update({ scheduled_at: nextIso })
              .eq('id', row.id)
            if (timeError) {
              setError(timeError.message)
              setLoading(false)
              return
            }
          }
        }
      } else {
        const { data: updatedRows, error: sessionError } = await supabase
          .from('sessions')
          .update({
            ...baseUpdates,
            scheduled_at: iso,
          })
          .eq('id', sessionId)
          .select('id')

        if (sessionError) {
          setError(sessionError.message)
          setLoading(false)
          return
        }
        if (!updatedRows || updatedRows.length === 0) {
          setError('Save failed — session was not updated. Check your permissions and try again.')
          setLoading(false)
          return
        }
      }

      if (form.program.trim().length > 0) {
        for (const id of targetIds) {
          const { error: programError } = await upsertProgram(id, form.program, user.id)
          if (programError) {
            setError(programError.message)
            setLoading(false)
            return
          }
        }
      }

      if (form.recurring && form.recurrence_end_date) {
        const recurringRes = await fetch('/api/sessions/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            session_type: form.session_type,
            start_at: iso,
            end_date: form.recurrence_end_date,
            location: form.location,
            allowed_tiers: allowedTiers,
            weekdays: form.weekdays,
            program: form.program,
            max_athletes: form.max_athletes ? Number(form.max_athletes) : null,
          }),
        })
        if (!recurringRes.ok) {
          const data = (await recurringRes.json().catch(() => null)) as { error?: string } | null
          setError(data?.error ?? 'Failed to create recurring sessions.')
          setLoading(false)
          return
        }
      }

      router.push('/dashboard/coach')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session.')
      setLoading(false)
    }
  }

  async function handleDelete(allInBatch: boolean) {
    const confirmText = allInBatch
      ? 'Delete all sessions created in this batch? This cannot be undone.'
      : 'Delete this session? This cannot be undone.'
    if (!window.confirm(confirmText)) return

    setDeleting(true)
    setError('')

    const ids = allInBatch && batchSessionIds.length > 0 ? Array.from(new Set(batchSessionIds)) : [sessionId]
    if (ids.length === 0) {
      setDeleting(false)
      router.push('/dashboard/coach')
      router.refresh()
      return
    }

    const { error: bErr } = await supabase.from('bookings').delete().in('session_id', ids)
    if (bErr) {
      setError(bErr.message)
      setDeleting(false)
      return
    }
    const { error: fErr } = await supabase.from('feedback').delete().in('session_id', ids)
    if (fErr) {
      setError(fErr.message)
      setDeleting(false)
      return
    }
    const { error: pErr } = await supabase.from('programs').delete().in('session_id', ids)
    if (pErr) {
      setError(pErr.message)
      setDeleting(false)
      return
    }
    const { data: deletedRows, error: sErr } = await supabase.from('sessions').delete().in('id', ids).select('id')
    if (sErr) {
      setError(sErr.message)
      setDeleting(false)
      return
    }
    if (!deletedRows || deletedRows.length === 0) {
      setError('Delete failed — no sessions were removed. Check your permissions and try again.')
      setDeleting(false)
      return
    }

    setDeleting(false)
    router.push('/dashboard/coach')
    router.refresh()
  }

  async function handleCancelSession(allInBatch: boolean) {
    const confirmText = allInBatch
      ? 'Cancel all sessions in this batch? They will remain in records with cancelled status.'
      : 'Cancel this session? It will remain in records with cancelled status.'
    if (!window.confirm(confirmText)) return

    setCancelling(true)
    setError('')

    const ids = allInBatch && batchSessionIds.length > 0 ? Array.from(new Set(batchSessionIds)) : [sessionId]
    const { data: updatedRows, error: updateErr } = await supabase
      .from('sessions')
      .update({ status: 'cancelled' })
      .in('id', ids)
      .select('id')

    if (updateErr) {
      setError(updateErr.message)
      setCancelling(false)
      return
    }
    if (!updatedRows || updatedRows.length === 0) {
      setError('Cancel failed — no sessions were updated. Check your permissions and try again.')
      setCancelling(false)
      return
    }

    setCancelling(false)
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

      <label style={labelStyle}>Session description</label>
      <textarea
        style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
        placeholder="What is this session about?"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
        <input
          type="checkbox"
          checked={applyToBatch}
          onChange={(e) => setApplyToBatch(e.target.checked)}
          disabled={batchSessionIds.length <= 1}
          style={{ marginTop: '2px' }}
        />
        <span>
          Apply edits to all {batchSessionIds.length} sessions in this batch
          {batchSessionIds.length > 1
            ? ' (keeps each session date; applies the time above to every session).'
            : ' (only one session in this batch).'}
        </span>
      </label>

      <label style={labelStyle}>Location</label>
      <input
        style={inputStyle}
        placeholder="Location"
        value={form.location}
        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
      />

      <div style={{ marginBottom: '16px' }}>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
            style={{ marginRight: '8px' }}
          />
          Generate recurring sessions (creates new sessions from this one)
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
            {([
              [0, 'Sun'],
              [1, 'Mon'],
              [2, 'Tue'],
              [3, 'Wed'],
              [4, 'Thu'],
              [5, 'Fri'],
              [6, 'Sat'],
            ] as const).map(([day, label]) => (
              <button
                key={String(day)}
                type="button"
                onClick={() => handleWeekdayToggle(day)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '0.5px solid #333',
                  background: form.weekdays.includes(day) ? '#fff' : '#1a1a1a',
                  color: form.weekdays.includes(day) ? '#000' : '#666',
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {['standard', 'performance_100m', 'performance_400m', 'elite', 'youth_standard', 'youth_elite'].map((tier) => (
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
              fontFamily: 'var(--font-geist-mono)',
              fontWeight: '900',
              boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
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
        placeholder="Warm up: 10 min..."
        value={form.program}
        onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))}
      />

      {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || deleting || cancelling}
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
            cursor: loading || deleting || cancelling ? 'not-allowed' : 'pointer',
            opacity: loading || deleting || cancelling ? 0.7 : 1,
        }}
      >
        {loading ? 'Saving...' : form.recurring ? 'Save & create recurring sessions' : 'Save changes'}
      </button>

      <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
        <button
          type="button"
          onClick={() => handleCancelSession(false)}
          disabled={loading || deleting || cancelling}
          style={{
            width: '100%',
            padding: '10px',
            background: '#000',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'var(--font-geist-mono)',
            fontWeight: '900',
            boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
            cursor: loading || deleting || cancelling ? 'not-allowed' : 'pointer',
            opacity: loading || deleting || cancelling ? 0.7 : 1,
          }}
        >
          {cancelling ? 'Cancelling...' : 'Cancel this session'}
        </button>
        <button
          type="button"
          onClick={() => handleCancelSession(true)}
          disabled={loading || deleting || cancelling}
          style={{
            width: '100%',
            padding: '10px',
            background: '#000',
            color: '#fff',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'var(--font-geist-mono)',
            fontWeight: '900',
            boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
            cursor: loading || deleting || cancelling ? 'not-allowed' : 'pointer',
            opacity: loading || deleting || cancelling ? 0.7 : 1,
          }}
        >
          {cancelling ? 'Cancelling batch...' : 'Cancel entire created-at batch'}
        </button>
        <button
          type="button"
          onClick={() => handleDelete(false)}
          disabled={loading || deleting || cancelling}
          style={{
            width: '100%',
            padding: '10px',
            background: '#111',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'var(--font-geist-mono)',
            fontWeight: '900',
            boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
            cursor: loading || deleting || cancelling ? 'not-allowed' : 'pointer',
            opacity: loading || deleting || cancelling ? 0.7 : 1,
          }}
        >
          {deleting ? 'Deleting...' : 'Delete this session'}
        </button>
        <button
          type="button"
          onClick={() => handleDelete(true)}
          disabled={loading || deleting || cancelling}
          style={{
            width: '100%',
            padding: '10px',
            background: '#000',
            color: '#fff',
            border: '1px solid #f87171',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'var(--font-geist-mono)',
            fontWeight: '900',
            boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
            cursor: loading || deleting || cancelling ? 'not-allowed' : 'pointer',
            opacity: loading || deleting || cancelling ? 0.7 : 1,
          }}
        >
          {deleting ? 'Deleting batch...' : 'Delete entire created-at batch'}
        </button>
      </div>

      <SessionAthleteBooker
        sessionIds={applyToBatch ? batchSessionIds : [sessionId]}
        allowedTiers={form.single_tier_only ? [form.single_tier] : form.allowed_tiers}
      />
    </div>
  )
}

