'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, MessageCircle, User } from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/athlete/book', label: 'Workouts', icon: CalendarDays },
  { href: '/dashboard/coach/feedback', label: 'Feedback', icon: MessageCircle },
  { href: '/dashboard/athlete/profile', label: 'Profile', icon: User },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-md md:hidden">
      <div className="grid grid-cols-4">
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
