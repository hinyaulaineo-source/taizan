'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SelfCheckInButton({
  sessionId,
  initialCheckedIn,
}: {
  sessionId: string
  initialCheckedIn: boolean | null
}) {
  const router = useRouter()
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    const next = checkedIn !== true
    setLoading(true)
    setError('')

    const res = await fetch('/api/attendance/self', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, checkedIn: next }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to update check-in.')
      setLoading(false)
      return
    }

    setCheckedIn(next)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {checkedIn === true ? (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300">
            You checked in
          </span>
          <Button
            onClick={toggle}
            disabled={loading}
            variant="outline"
            className="text-sm"
          >
            {loading ? 'Updating...' : 'Undo check-in'}
          </Button>
        </div>
      ) : checkedIn === false ? (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-red-900/40 px-3 py-1 text-xs font-medium text-red-300">
            Marked absent
          </span>
          <Button
            onClick={toggle}
            disabled={loading}
            className="bg-emerald-600 text-sm text-white hover:bg-emerald-700"
          >
            {loading ? 'Checking in...' : 'Check in now'}
          </Button>
        </div>
      ) : (
        <Button
          onClick={toggle}
          disabled={loading}
          className="bg-emerald-600 text-sm text-white hover:bg-emerald-700"
        >
          {loading ? 'Checking in...' : 'Check in to this session'}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
