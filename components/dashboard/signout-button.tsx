'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignoutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  return (
    <button
      type="button"
      disabled={loading}
      className={className}
      onClick={async () => {
        setLoading(true)
        try {
          await fetch('/api/auth/signout', { method: 'POST' })
        } finally {
          router.push('/login')
          router.refresh()
        }
      }}
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
