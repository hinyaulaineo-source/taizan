'use client'

import { useCallback, useEffect, useState } from 'react'

type Athlete = {
  id: string
  fullName: string
  email: string
  tier: string
  bookedCount: number
  booked: boolean
  partial: boolean
}

export default function SessionAthleteBooker({
  sessionIds,
  allowedTiers,
}: {
  sessionIds: string[]
  allowedTiers: string[]
}) {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [bookingAll, setBookingAll] = useState(false)
  const [actionIds, setActionIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const idsKey = sessionIds.slice().sort().join(',')
  const tiersKey = allowedTiers.slice().sort().join(',')

  const fetchAthletes = useCallback(async () => {
    setLoadingList(true)
    setError('')
    const params = new URLSearchParams()
    sessionIds.forEach((id) => params.append('sessionId', id))
    allowedTiers.forEach((t) => params.append('tier', t))
    const res = await fetch(`/api/bookings/coach?${params}`)
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to load athletes.')
      setLoadingList(false)
      return
    }
    const data = (await res.json()) as { athletes: Athlete[]; totalSessions: number }
    setAthletes(data.athletes)
    setTotalSessions(data.totalSessions)
    setLoadingList(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, tiersKey])

  useEffect(() => {
    if (sessionIds.length > 0) fetchAthletes()
  }, [fetchAthletes, sessionIds.length])

  async function bookAll() {
    setBookingAll(true)
    setMessage('')
    setError('')
    const res = await fetch('/api/bookings/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds, bookAllEligible: true, allowedTiers }),
    })
    const data = (await res.json().catch(() => null)) as {
      booked?: number
      sessions?: number
      error?: string
    } | null
    if (!res.ok) {
      setError(data?.error ?? 'Failed to book athletes.')
      setBookingAll(false)
      return
    }
    setMessage(`Booked ${data?.booked ?? 0} slots across ${data?.sessions ?? 0} session(s).`)
    setBookingAll(false)
    fetchAthletes()
  }

  async function bookSingle(athleteId: string) {
    setActionIds((prev) => new Set(prev).add(athleteId))
    setMessage('')
    setError('')
    const res = await fetch('/api/bookings/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds, athleteIds: [athleteId] }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to book athlete.')
    }
    setActionIds((prev) => { const n = new Set(prev); n.delete(athleteId); return n })
    fetchAthletes()
  }

  async function unbookSingle(athleteId: string) {
    setActionIds((prev) => new Set(prev).add(athleteId))
    setMessage('')
    setError('')
    const res = await fetch('/api/bookings/coach', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds, athleteIds: [athleteId] }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to unbook athlete.')
    }
    setActionIds((prev) => { const n = new Set(prev); n.delete(athleteId); return n })
    fetchAthletes()
  }

  async function unbookAll() {
    const bookedIds = athletes.filter((a) => a.booked || a.partial).map((a) => a.id)
    if (bookedIds.length === 0) return
    if (!window.confirm(`Unbook ${bookedIds.length} athlete(s) from ${totalSessions} session(s)?`)) return
    setBookingAll(true)
    setMessage('')
    setError('')
    const res = await fetch('/api/bookings/coach', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds, athleteIds: bookedIds }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to unbook athletes.')
      setBookingAll(false)
      return
    }
    setMessage(`Unbooked ${bookedIds.length} athlete(s) from ${totalSessions} session(s).`)
    setBookingAll(false)
    fetchAthletes()
  }

  const filtered = athletes.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
  })

  const notBookedCount = athletes.filter((a) => !a.booked).length
  const anyBookedCount = athletes.filter((a) => a.booked || a.partial).length
  const isBatch = totalSessions > 1

  const btnBase: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'var(--font-geist-mono)',
    fontWeight: '900',
    boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
    border: 'none',
  }

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid #333', paddingTop: '20px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
        Athlete bookings {isBatch && <span style={{ fontWeight: '400', color: '#888' }}>({totalSessions} sessions)</span>}
      </h3>
      <p style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
        Filtering by tiers: {allowedTiers.length > 0 ? allowedTiers.join(', ') : 'none selected'}
      </p>

      {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
      {message && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '10px' }}>{message}</p>}

      {loadingList ? (
        <p style={{ color: '#888', fontSize: '13px' }}>Loading eligible athletes...</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={bookAll}
              disabled={bookingAll || notBookedCount === 0}
              style={{
                ...btnBase,
                background: '#fff',
                color: '#000',
                opacity: bookingAll || notBookedCount === 0 ? 0.5 : 1,
                cursor: bookingAll || notBookedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {bookingAll ? 'Working...' : `Book all (${notBookedCount})`}
            </button>
            <button
              type="button"
              onClick={unbookAll}
              disabled={bookingAll || anyBookedCount === 0}
              style={{
                ...btnBase,
                background: '#000',
                color: '#f87171',
                border: '1px solid #333',
                opacity: bookingAll || anyBookedCount === 0 ? 0.5 : 1,
                cursor: bookingAll || anyBookedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Unbook all ({anyBookedCount})
            </button>
            <span style={{ color: '#888', fontSize: '12px' }}>
              {anyBookedCount} booked · {athletes.length} eligible
            </span>
          </div>

          <input
            type="text"
            placeholder="Search athletes by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#1a1a1a',
              border: '0.5px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
              marginBottom: '10px',
            }}
          />

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <p style={{ color: '#666', fontSize: '13px', padding: '8px 0' }}>No athletes found.</p>
            )}
            {filtered.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 10px',
                  borderBottom: '1px solid #222',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '13px', color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.fullName}
                  </p>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                    {a.email} · {a.tier}
                    {isBatch && a.bookedCount > 0 && (
                      <span style={{ color: a.booked ? '#4ade80' : '#f59e0b' }}>
                        {' '}· {a.bookedCount}/{totalSessions}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {a.booked ? (
                    <>
                      <span style={{
                        fontSize: '11px',
                        color: '#4ade80',
                        background: '#064e3b',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        whiteSpace: 'nowrap',
                      }}>
                        Booked
                      </span>
                      <button
                        type="button"
                        onClick={() => unbookSingle(a.id)}
                        disabled={actionIds.has(a.id)}
                        style={{
                          ...btnBase,
                          padding: '4px 10px',
                          fontSize: '11px',
                          background: '#000',
                          color: '#f87171',
                          border: '1px solid #333',
                          opacity: actionIds.has(a.id) ? 0.5 : 1,
                          cursor: actionIds.has(a.id) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {actionIds.has(a.id) ? '...' : 'Unbook'}
                      </button>
                    </>
                  ) : a.partial ? (
                    <>
                      <span style={{
                        fontSize: '11px',
                        color: '#f59e0b',
                        background: '#422006',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        whiteSpace: 'nowrap',
                      }}>
                        Partial
                      </span>
                      <button
                        type="button"
                        onClick={() => bookSingle(a.id)}
                        disabled={actionIds.has(a.id)}
                        style={{
                          ...btnBase,
                          padding: '4px 10px',
                          fontSize: '11px',
                          background: '#fff',
                          color: '#000',
                          opacity: actionIds.has(a.id) ? 0.5 : 1,
                          cursor: actionIds.has(a.id) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {actionIds.has(a.id) ? '...' : 'Book all'}
                      </button>
                      <button
                        type="button"
                        onClick={() => unbookSingle(a.id)}
                        disabled={actionIds.has(a.id)}
                        style={{
                          ...btnBase,
                          padding: '4px 10px',
                          fontSize: '11px',
                          background: '#000',
                          color: '#f87171',
                          border: '1px solid #333',
                          opacity: actionIds.has(a.id) ? 0.5 : 1,
                          cursor: actionIds.has(a.id) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {actionIds.has(a.id) ? '...' : 'Unbook'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bookSingle(a.id)}
                      disabled={actionIds.has(a.id)}
                      style={{
                        ...btnBase,
                        padding: '4px 12px',
                        fontSize: '11px',
                        background: '#fff',
                        color: '#000',
                        opacity: actionIds.has(a.id) ? 0.5 : 1,
                        cursor: actionIds.has(a.id) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {actionIds.has(a.id) ? 'Booking...' : 'Book'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
