'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type CoachRequest = {
  id: string
  full_name: string | null
  email: string
  coach_requested_at: string | null
}

export default function CoachApprovalForm({ requests }: { requests: CoachRequest[] }) {
  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(new Date(value))

  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(profileId: string, action: 'approve' | 'reject') {
    setBusyId(profileId)
    setError('')
    try {
      const response = await fetch('/api/admin/coach-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, action }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(
          data?.error
            ? data.error
            : `Failed to update coach request (HTTP ${response.status}).`,
        )
        setBusyId(null)
        return
      }

      setBusyId(null)
      router.refresh()
    } catch (e) {
      setError('Network error. Please try again.')
      setBusyId(null)
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-zinc-500">No pending coach requests.</p>
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-zinc-100">{r.full_name ?? 'Unnamed'}</p>
            <p className="text-xs text-zinc-500">{r.email}</p>
            {r.coach_requested_at && (
              <p className="mt-1 text-xs text-zinc-500">
                Requested: {formatDateTime(r.coach_requested_at)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => run(r.id, 'approve')}
              variant="outline"
              disabled={busyId === r.id}
              className="hover:bg-zinc-200 border border-border"
            >
              Approve coach
            </Button>
            <Button
              variant="outline"
              onClick={() => run(r.id, 'reject')}
              disabled={busyId === r.id}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}
