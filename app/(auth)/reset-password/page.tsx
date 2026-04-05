'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MIN_LEN = 6

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [canSetPassword, setCanSetPassword] = useState(false)
  const [done, setDone] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    let authListener: { unsubscribe: () => void } | null = null

    void (async () => {
      const search = new URLSearchParams(window.location.search)
      const oauthErr = search.get('error')
      const oauthErrDesc = search.get('error_description')
      if (oauthErr) {
        if (!cancelled) {
          setLinkError(
            oauthErrDesc
              ? decodeURIComponent(oauthErrDesc.replace(/\+/g, ' '))
              : oauthErr,
          )
          setChecking(false)
        }
        return
      }

      let recovered = false

      // Implicit flow: Supabase often redirects with tokens in the #hash (not ?code=)
      const rawHash = window.location.hash.replace(/^#/, '')
      if (rawHash) {
        const hashParams = new URLSearchParams(rawHash)
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        if (access_token && refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (cancelled) return
          if (!sessErr) {
            recovered = true
            window.history.replaceState(null, '', window.location.pathname)
          } else {
            setLinkError(sessErr.message)
          }
        }
      }

      // PKCE: ?code= in query string
      if (!recovered) {
        const code = search.get('code')
        if (code) {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (cancelled) return
          if (!codeErr) {
            recovered = true
            window.history.replaceState(null, '', window.location.pathname)
          } else {
            setLinkError((prev) => prev ?? codeErr.message)
          }
        }
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return
        if (event === 'PASSWORD_RECOVERY' && session) {
          setCanSetPassword(true)
          setChecking(false)
        }
        if (event === 'INITIAL_SESSION' && session) {
          setCanSetPassword(true)
          setChecking(false)
        }
      })
      authListener = subscription

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (recovered || session) {
        setCanSetPassword(true)
      }
      setChecking(false)
    })()

    return () => {
      cancelled = true
      authListener?.unsubscribe()
    }
  }, [])

  async function handleSubmit() {
    setError('')
    if (password.length < MIN_LEN) {
      setError(`Password must be at least ${MIN_LEN} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const client = createClient()
    const { error: updateErr } = await client.auth.updateUser({ password })
    setLoading(false)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    setDone(true)
    await client.auth.signOut()
    router.replace('/login?reset=success')
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#888',
          fontSize: '14px',
        }}
      >
        Verifying link…
      </div>
    )
  }

  if (!canSetPassword && !done) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '2rem',
            background: '#111',
            border: '0.5px solid #222',
            borderRadius: '16px',
          }}
        >
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '500', marginBottom: '12px' }}>
            Link invalid or expired
          </h1>
          {linkError ? (
            <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem', lineHeight: 1.5 }}>
              {linkError}
            </p>
          ) : null}
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Request a new link from the same site you use to sign in (localhost vs production URLs must
            match what is allowed in Supabase). If the email link opens the wrong domain, request again on
            the correct one.
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: 'inline-block',
              color: '#fff',
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            Request new link
          </Link>
          <p style={{ marginTop: '1rem' }}>
            <Link href="/login" style={{ color: '#888', fontSize: '13px' }}>
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        <p style={{ color: '#86efac', fontSize: '14px' }}>Password updated. Redirecting…</p>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          background: '#111',
          border: '0.5px solid #222',
          borderRadius: '16px',
        }}
      >
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>
          New password
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '2rem' }}>
          Choose a strong password for your TrackZAN account.
        </p>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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

        {error ? (
          <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
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
          {loading ? 'Saving…' : 'Update password'}
        </button>

        <p style={{ color: '#888', fontSize: '13px', marginTop: '1.25rem', textAlign: 'center' }}>
          <Link href="/login" style={{ color: '#fff', textDecoration: 'underline' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
