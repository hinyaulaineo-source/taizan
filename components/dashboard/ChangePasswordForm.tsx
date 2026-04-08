'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizePhoneDigits } from '@/lib/phone-auth'
import { Button } from '@/components/ui/button'

/**
 * Verifies current password (including phone-as-password formatting), then sets a new password.
 */
export default function ChangePasswordForm({
  variant = 'card',
}: {
  /** `card` uses semantic dashboard tokens; `zinc` matches athlete profile pages. */
  variant?: 'card' | 'zinc'
}) {
  const [current, setCurrent] = useState('')
  const [nextPw, setNextPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const box =
    variant === 'zinc'
      ? 'rounded-lg border border-zinc-700 bg-zinc-950/50 p-4'
      : 'rounded-lg border border-border bg-card/50 p-4'

  const label = variant === 'zinc' ? 'text-xs font-medium uppercase tracking-wide text-zinc-500' : 'text-xs font-medium text-muted-foreground'
  const input =
    variant === 'zinc'
      ? 'mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none'
      : 'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

  async function verifyCurrentPassword(email: string, raw: string): Promise<boolean> {
    const supabase = createClient()
    const trimmed = raw.trim()
    const digit = normalizePhoneDigits(trimmed)
    const candidates = [...new Set([trimmed, digit].filter((s) => s.length > 0))]
    for (const password of candidates) {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (!signErr) return true
    }
    return false
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOk(false)
    if (nextPw.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (nextPw !== confirm) {
      setError('New passwords do not match.')
      return
    }
    if (!current.trim()) {
      setError('Enter your current password.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Not signed in.')
        setLoading(false)
        return
      }

      const valid = await verifyCurrentPassword(user.email, current)
      if (!valid) {
        setError('Current password is incorrect.')
        setLoading(false)
        return
      }

      const { error: upErr } = await supabase.auth.updateUser({ password: nextPw })
      if (upErr) {
        setError(upErr.message)
        setLoading(false)
        return
      }

      setOk(true)
      setCurrent('')
      setNextPw('')
      setConfirm('')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={box}>
      <h2 className={variant === 'zinc' ? 'text-sm font-semibold text-zinc-100' : 'text-sm font-semibold text-foreground'}>
        Change password
      </h2>
      <p className={variant === 'zinc' ? 'mt-1 text-xs text-zinc-500' : 'mt-1 text-xs text-muted-foreground'}>
        If you normally sign in with your phone number, enter that as the current password (spaces ok). After changing, use the
        new password—or update your profile phone to match if you want phone sign-in again.
      </p>
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
        <div>
          <label htmlFor="ch-pw-current" className={label}>
            Current password
          </label>
          <input
            id="ch-pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="ch-pw-new" className={label}>
            New password
          </label>
          <input
            id="ch-pw-new"
            type="password"
            autoComplete="new-password"
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="ch-pw-confirm" className={label}>
            Confirm new password
          </label>
          <input
            id="ch-pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={input}
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {ok ? <p className="text-sm text-emerald-400">Password updated.</p> : null}
        <Button type="submit" disabled={loading} variant="outline" size="sm">
          {loading ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </div>
  )
}
