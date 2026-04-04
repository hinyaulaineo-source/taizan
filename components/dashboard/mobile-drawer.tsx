'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import SidebarNav from './sidebar-nav'
import Link from 'next/link'
import SignoutButton from './signout-button'

export default function MobileDrawer({
  navItems,
  displayName,
  role,
}: {
  navItems: { href: string; label: string }[]
  displayName: string
  role: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const overlay = open && mounted && (
    <div
      className="fixed inset-0 z-[200] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-drawer-title"
    >
      {/* Opaque scrim — avoids oklch/% opacity quirks on mobile WebKit */}
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/70"
        onClick={() => setOpen(false)}
        aria-label="Close menu"
      />

      <div
        className="pointer-events-auto absolute left-0 top-0 z-10 flex h-full max-h-[100dvh] w-[min(20rem,100vw)] flex-col overflow-y-auto border-r border-zinc-700 px-4 py-5 text-foreground shadow-2xl"
        style={{
          backgroundColor: '#18181b',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">TrackZAN</p>
            <h2 id="mobile-drawer-title" className="mt-2 text-lg font-semibold text-foreground">
              The Basecamp
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{role}</p>
            <p className="mt-4 text-sm text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-zinc-900 px-2 py-1 text-sm text-foreground hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="mt-6">
          <SidebarNav items={navItems} />
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-md border border-border bg-zinc-900 px-3 py-2 text-center text-sm text-foreground hover:bg-zinc-800"
          >
            Home
          </Link>
          <SignoutButton className="flex-1 rounded-md border border-border bg-zinc-900 px-3 py-2 text-center text-sm text-foreground hover:bg-zinc-800" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent md:hidden"
      >
        Menu
      </button>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  )
}
