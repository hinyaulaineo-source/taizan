import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types/roles'

const PROTECTED_ROUTES: Record<string, UserRole[]> = {
  '/dashboard/admin':    ['owner'],
  '/dashboard/sessions': ['owner', 'coach'],
  '/dashboard/feedback': ['owner', 'coach', 'athlete', 'parent'],
  '/dashboard/bookings': ['athlete', 'parent'],
}

export async function proxy(request: NextRequest) {
  // Do not pass the full request into NextResponse.next({ request }).
  // Next.js 16.2 can 404 valid nested App Router pages when that object is forwarded.
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isDashboard = pathname.startsWith('/dashboard')
  const isLogin = pathname === '/login'
  const isSignup = pathname === '/signup'

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/?login=1', request.url))
  }

  if (user && (isLogin || isSignup)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && isDashboard) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role as UserRole | undefined

    for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
      if (pathname.startsWith(route) && userRole && !allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login', '/signup'],
}
