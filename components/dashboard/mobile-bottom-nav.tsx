'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, MessageCircle, User, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

const athleteItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/athlete/book', label: 'Workouts', icon: CalendarDays },
  { href: '/dashboard/coach/feedback', label: 'Feedback', icon: MessageCircle },
  { href: '/dashboard/athlete/profile', label: 'Profile', icon: User },
]

const parentItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/parent', label: 'Athletes', icon: Users },
]

const coachItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/coach/new-session', label: 'New Session', icon: CalendarDays },
  { href: '/dashboard/coach/feedback', label: 'Feedback', icon: MessageCircle },
  { href: '/dashboard/coach/profile', label: 'Profile', icon: User },
]

function getItems(role?: string): NavItem[] {
  if (role === 'parent') return parentItems
  if (role === 'coach') return coachItems
  return athleteItems
}

export default function MobileBottomNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const items = getItems(role)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-md md:hidden">
      <div className={`grid grid-cols-${items.length}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
