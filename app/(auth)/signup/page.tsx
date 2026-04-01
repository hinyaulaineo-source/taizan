'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'athlete' | 'parent' | 'coach'>('athlete')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSignup() {
    setLoading(true)
    setError('')

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          desired_role: role,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If the user is immediately signed in, create a profiles row.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? email,
            full_name: fullName,
            role: role === 'parent' ? 'parent' : 'athlete',
            coach_request_pending: role === 'coach',
            coach_requested_at: role === 'coach' ? new Date().toISOString() : null,
          },
          { onConflict: 'id' },
        )

      if (profileError) {
        // Don't block signup; dashboard role routing will auto-fix later.
        console.warn('profile upsert failed', profileError)
      }

      router.push('/dashboard')
      return
    }

    // Otherwise, user must verify email; send them back to login.
    setError('Check your email to confirm your account, then sign in.')
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
          maxWidth: '420px',
          padding: '2rem',
          background: '#111',
          border: '0.5px solid #222',
          borderRadius: '16px',
        }}
      >
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>
          TAIZAN Athletics
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '2rem' }}>
          Create your account to book sessions.
        </p>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Full name (optional)
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. John Doe"
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

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Identity
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'athlete' | 'parent' | 'coach')}
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
          >
            <option value="athlete">Athlete</option>
            <option value="parent">Parent</option>
            <option value="coach">Coach (requires owner approval)</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
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

        {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

        <button
          onClick={handleSignup}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Creating...' : 'Sign up'}
        </button>

        <p style={{ color: '#888', fontSize: '13px', marginTop: '14px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#fff', textDecoration: 'underline' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

