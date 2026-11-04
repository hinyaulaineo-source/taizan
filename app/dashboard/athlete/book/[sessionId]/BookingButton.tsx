'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BookingButton({
  sessionId,
  disabled,
  alreadyBooked,
}: {
  sessionId: string
  disabled: boolean
  alreadyBooked: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleBook() {
    setLoading(true)
    setError('')

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Unable to book this session right now.')
      setLoading(false)
      return
    }

    router.push(`/dashboard/athlete/session/${sessionId}`)
    router.refresh()
  }

  return (
    <div>
      {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
      <button
        onClick={handleBook}
        disabled={disabled || alreadyBooked || loading}
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
          cursor: disabled || alreadyBooked || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || alreadyBooked || loading ? 0.6 : 1,
        }}
      >
        {alreadyBooked ? 'Already booked' : loading ? 'Booking...' : 'Book session'}
      </button>
    </div>
  )
}
