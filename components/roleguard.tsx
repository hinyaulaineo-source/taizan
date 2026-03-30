'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/roles'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user
      if (!user) return setLoading(false)
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          setRole((profile as { role: UserRole } | null)?.role ?? null)
          setLoading(false)
        })
    })
  }, [])

  if (loading) return null
  return role && allowedRoles.includes(role) ? <>{children}</> : <>{fallback}</>
}
