'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApprovalButtons({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const router = useRouter()

  async function updateStatus(status: string) {
    setLoading(status)
    setError('')
    const response = await fetch('/api/sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, status }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string | { message?: string } }
        | null
      const message =
        typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.message ?? 'Unable to update session.'
      setError(message)
      setLoading(null)
      return
    }
    setLoading(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => updateStatus('published')}
          disabled={loading !== null}
          className="rounded-md bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'published' ? 'Publishing...' : 'Approve'}
        </button>
        <button
          onClick={() => updateStatus('draft')}
          disabled={loading !== null}
          className="rounded-md border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'draft' ? 'Returning...' : 'Return to coach'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}
