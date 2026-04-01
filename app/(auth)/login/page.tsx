'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
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
          TAIZAN Athletics
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '2rem' }}>
          The Basecamp. Sign in to continue.
        </p>

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
            placeholder="••••••••"
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

        {error && (
          <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
        )}

        <button
          onClick={handleLogin}
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p style={{ color: '#888', fontSize: '13px', marginTop: '14px', textAlign: 'center' }}>
          New here?{' '}
          <a href="/signup" style={{ color: '#fff', textDecoration: 'underline' }}>
            Create an account
          </a>
        </p>
      </div>
    </div>
  )
}
