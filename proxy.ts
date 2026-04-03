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
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
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

  // Unauthenticated users trying to access protected routes → login
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users on login/signup → dashboard
  if (user && (isLogin || isSignup)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based route protection for dashboard sub-paths
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
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
