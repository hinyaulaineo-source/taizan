'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordResetOk, setPasswordResetOk] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setPasswordResetOk(q.get('reset') === 'success')
  }, [])

  async function handleLogin() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      // Hard navigation: sends cookies set by the browser Supabase client on the next request.
      // Do not use router.refresh() here — it can hang and block navigation.
      window.location.replace('/dashboard')
    } catch {
      setError('Something went wrong. Check your connection and try again.')
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
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="********"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
