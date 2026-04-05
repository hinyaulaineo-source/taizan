'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function siteUrlForRedirect() {
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter your email.')
      setLoading(false)
      return
    }

    const redirectTo = `${siteUrlForRedirect()}/reset-password`
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    })

    if (resetErr) {
      const msg = resetErr.message
      const hint =
        msg.includes('recovery email') || /sending.*email/i.test(msg)
          ? ' (Supabase could not send mail: check Dashboard → Logs → Auth, then set up Authentication → SMTP with a verified sender.)'
          : ''
      setError(`${msg}${hint}`)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
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
          Reset password
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '2rem' }}>
          Enter your account email. We will send you a link to choose a new password.
        </p>

        {done ? (
          <p style={{ color: '#86efac', fontSize: '14px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Check your inbox for an email from us. If it does not arrive in a minute or two, look in
            spam or confirm the address is correct.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}

        <p style={{ color: '#888', fontSize: '13px', marginTop: '1.25rem', textAlign: 'center' }}>
          <Link href="/login" style={{ color: '#fff', textDecoration: 'underline' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
