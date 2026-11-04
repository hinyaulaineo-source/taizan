'use client'

import { useState } from 'react'
import Link from 'next/link'
import { looksLikeEmail, namesMatch } from '@/lib/auth/person-name'
import { formatSignInError } from '@/lib/auth/sign-in-error'

export default function MemberLoginForm({
  passwordResetOk = false,
}: {
  passwordResetOk?: boolean
}) {
  const [identifier, setIdentifier] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    const trimmedId = identifier.trim()
    const trimmedSecret = secret.trim()
    if (!trimmedId || !trimmedSecret) {
      setError('Enter your email or name, and your password.')
      return
    }
    if (!looksLikeEmail(trimmedId) && namesMatch(trimmedId, trimmedSecret)) {
      setError('Full name cannot be used as a password. Use your phone number or password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmedId, secret: trimmedSecret }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        const rawMessage = data?.error
        if (process.env.NODE_ENV === 'development' && rawMessage) {
          console.error('Sign-in error:', rawMessage)
        }
        setError(formatSignInError(rawMessage))
        return
      }
      window.location.replace('/dashboard')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Sign-in exception:', err)
      }
      const message = err instanceof Error ? err.message : undefined
      setError(formatSignInError(message ?? 'Something went wrong. Check your connection and try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Members</p>
      <h2 className="mt-2 text-2xl font-semibold text-foreground">Sign in</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter The Basecamp with your email or registered name and password.
      </p>

      {passwordResetOk ? (
        <p className="mt-4 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Your password was updated. Sign in with your new password.
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="member-identifier" className="mb-1.5 block text-xs text-muted-foreground">
            Email or full name
          </label>
          <input
            id="member-identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or your registered name"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </div>

        <div>
          <label htmlFor="member-secret" className="mb-1.5 block text-xs text-muted-foreground">
            Password
          </label>
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground/80">
            Use the same phone digits you registered with (with or without country code), or your custom
            password. Full name cannot be used as a password.
          </p>
          <input
            id="member-secret"
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Phone number or password"
            onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </div>
      </div>

      <p className="mt-3 text-right">
        <Link href="/forgot-password" className="text-sm text-muted-foreground underline hover:text-foreground">
          Forgot password?
        </Link>
      </p>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleLogin()}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-black text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/signup" className="text-foreground underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
