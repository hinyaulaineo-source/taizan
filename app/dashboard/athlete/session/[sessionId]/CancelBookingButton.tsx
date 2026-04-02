'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelBookingButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function cancelBooking() {
    if (!window.confirm('Cancel this booking?')) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Failed to cancel booking.')
        setLoading(false)
        return
      }
      router.push('/dashboard/athlete')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="pt-2">
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={cancelBooking}
        disabled={loading}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? 'Cancelling...' : 'Cancel booking'}
      </button>
    </div>
  )
}
