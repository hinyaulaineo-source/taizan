'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

interface Athlete {
  id: string
  full_name: string | null
  email: string
}

interface Session {
  id: string
  title: string
  scheduled_at: string
}

export default function FeedbackForm({ athletes, sessions }: { athletes: Athlete[]; sessions: Session[] }) {
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(value))

  const router = useRouter()
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [sessionId, setSessionId] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!athleteId || !content.trim()) {
      setError('Choose an athlete and enter feedback.')
      return
    }

    setLoading(true)
    setError('')
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, sessionId: sessionId || null, content }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to save feedback.')
      setLoading(false)
      return
    }

    router.push('/dashboard/coach')
    router.refresh()
  }

  const inputStyle: CSSProperties = {
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

  const labelStyle: CSSProperties = {
    color: '#888',
    fontSize: '12px',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <div>
      <label style={labelStyle}>Athlete</label>
      <select style={inputStyle} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
        {athletes.map((athlete) => (
          <option key={athlete.id} value={athlete.id}>
            {athlete.full_name ?? athlete.email}
          </option>
        ))}
      </select>

      <label style={labelStyle}>Session (optional)</label>
      <select style={inputStyle} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
        <option value="">General feedback</option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.title} ({formatDate(session.scheduled_at)})
          </option>
        ))}
      </select>

      <label style={labelStyle}>Feedback</label>
      <textarea
        style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
        placeholder="Progress notes, focus points, and next-session actions..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '14px' }}>{error}</p>}

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
        {loading ? 'Saving...' : 'Save feedback'}
      </button>
    </div>
  )
}
