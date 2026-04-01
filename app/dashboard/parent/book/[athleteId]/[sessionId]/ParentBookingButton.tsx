'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ParentBookingButton({
  athleteId,
  sessionId,
  disabled,
  alreadyBooked,
  previewOnly,
}: {
  athleteId: string
  sessionId: string
  disabled: boolean
  alreadyBooked: boolean
  previewOnly?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleBook() {
    setLoading(true)
    setError('')

    const response = await fetch('/api/parent-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteId, sessionId }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Unable to book this session right now.')
      setLoading(false)
      return
    }

    router.push('/dashboard/parent')
    router.refresh()
  }

  return (
    <div>
      {previewOnly && (
        <p style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '12px' }}>
          Owner preview: sign in as a parent to book for a linked athlete.
        </p>
      )}
      {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
      <button
        onClick={handleBook}
        disabled={previewOnly || disabled || alreadyBooked || loading}
        style={{
          width: '100%',
          padding: '11px',
          background: '#fff',
          color: '#000',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: disabled || alreadyBooked || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || alreadyBooked || loading ? 0.6 : 1,
        }}
      >
        {previewOnly
          ? 'Preview — booking disabled'
          : alreadyBooked
            ? 'Already booked'
            : loading
              ? 'Booking...'
              : 'Book session'}
      </button>
    </div>
  )
}

