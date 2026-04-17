import Link from 'next/link'
import { redirect } from 'next/navigation'
import SidebarNav from '@/components/dashboard/sidebar-nav'
import MobileDrawer from '@/components/dashboard/mobile-drawer'
import SignoutButton from '@/components/dashboard/signout-button'
import { normalizeRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role) ?? 'athlete'
  const displayName = profile?.full_name || user.email || 'TrackZAN User'

  const itemsByRole: Record<string, { href: string; label: string }[]> = {
    owner: [
      { href: '/dashboard/admin', label: 'Owner Dashboard' },
      { href: '/dashboard/coach', label: 'Coach View' },
      { href: '/dashboard/coach/profile', label: 'Coach profile' },
      { href: '/dashboard/athlete', label: 'Athlete View' },
      { href: '/dashboard/parent', label: 'Parent View' },
    ],
    coach: [
      { href: '/dashboard/coach', label: 'Coach Dashboard' },
      { href: '/dashboard/coach/profile', label: 'My profile' },
      { href: '/dashboard/coach/weekly', label: 'Weekly Schedule' },
      { href: '/dashboard/coach/new-session', label: 'New Session' },
      { href: '/dashboard/coach/feedback', label: 'Add Feedback' },
    ],
    athlete: [
      { href: '/dashboard/athlete', label: 'Athlete Dashboard' },
      { href: '/dashboard/athlete/training', label: 'Training log' },
      { href: '/dashboard/athlete/weekly', label: 'Weekly Schedule' },
      { href: '/dashboard/athlete/profile', label: 'My profile' },
    ],
    parent: [
      { href: '/dashboard/parent', label: 'Parent Dashboard' },
      { href: '/dashboard/parent/book', label: 'Book sessions' },
      { href: '/dashboard/parent/weekly', label: 'Weekly Schedule' },
      { href: '/dashboard/parent/profile', label: 'My profile' },
    ],
  }

  const navItems = itemsByRole[role] ?? itemsByRole.athlete

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="hidden min-h-screen w-72 border-r border-border bg-card/80 px-4 py-5 md:block">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">TrackZAN</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">The Basecamp</h2>
          <p className="mt-1 text-sm text-muted-foreground">{role}</p>
          <div className="mt-6">
            <SidebarNav items={navItems} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-provided avatar URL
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="hidden h-10 w-10 shrink-0 rounded-full border border-border object-cover sm:block"
                  />
                ) : null}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MobileDrawer navItems={navItems} displayName={displayName} role={role} />
                <div className="hidden items-center gap-2 md:flex">
                  <Link
                    href="/dashboard"
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-black text-foreground hover:bg-accent"
                  >
                    Home
                  </Link>
                  <SignoutButton className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent" />
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 px-4 py-6 md:px-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
