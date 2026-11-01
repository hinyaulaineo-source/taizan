'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatSignInError } from '@/lib/auth/sign-in-error'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordResetOk, setPasswordResetOk] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setPasswordResetOk(q.get('reset') === 'success')
  }, [])

  async function handleLogin() {
    const trimmedId = identifier.trim()
    const trimmedSecret = secret.trim()
    if (!trimmedId || !trimmedSecret) {
      setError('Enter your email or name, and your password or name.')
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        background: '#111',
        border: '0.5px solid #222',
        borderRadius: '16px',
      }}>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>
          TrackZAN
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '2rem' }}>
          The Basecamp. Sign in to continue.
        </p>

        {passwordResetOk ? (
          <p
            style={{
              color: '#86efac',
              fontSize: '13px',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}
          >
            Your password was updated. Sign in with your new password.
          </p>
        ) : null}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Email or full name
          </label>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="you@example.com or your registered name"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#1a1a1a',
              border: '0.5px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Password or full name
          </label>
          <p style={{ color: '#555', fontSize: '11px', marginBottom: '6px', lineHeight: 1.4 }}>
            Use your phone number (digits), a custom password, or your registered full name. You can also
            sign in with name + email.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Phone, password, or your full name"
            onKeyDown={e => e.key === 'Enter' && void handleLogin()}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#1a1a1a',
              border: '0.5px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        <p style={{ marginBottom: '16px', textAlign: 'right' }}>
          <Link href="/forgot-password" style={{ color: '#aaa', fontSize: '13px', textDecoration: 'underline' }}>
            Forgot password?
          </Link>
        </p>

        {error && (
          <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleLogin()}
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p style={{ color: '#888', fontSize: '13px', marginTop: '14px', textAlign: 'center' }}>
          New here?{' '}
          <Link href="/signup" style={{ color: '#fff', textDecoration: 'underline' }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
