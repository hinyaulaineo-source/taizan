'use client'

import { useState } from 'react'
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 md:hidden"
      >
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-80 border-r border-zinc-800 bg-zinc-950/95 px-4 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500">TAIZAN Athletics</p>
                <h2 className="mt-2 text-lg font-semibold text-white">The Basecamp</h2>
                <p className="mt-1 text-sm text-zinc-400">{role}</p>
                <p className="mt-4 text-sm text-zinc-300">Signed in as</p>
                <p className="text-sm font-medium text-zinc-200">{displayName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-200 hover:bg-zinc-900"
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
                className="flex-1 rounded-md border border-zinc-700 px-3 py-2 text-center text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Home
              </Link>
              <SignoutButton className="flex-1 rounded-md border border-zinc-700 px-3 py-2 text-center text-sm text-zinc-200 hover:bg-zinc-900" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

