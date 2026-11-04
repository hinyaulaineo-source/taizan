'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MemberLoginSidebar from '@/components/auth/MemberLoginSidebar'

const PROGRAMS = [
  {
    name: 'Youth',
    detail: 'Foundations for developing athletes — speed, mechanics, and race habits.',
  },
  {
    name: 'Standard',
    detail: 'Weekly track sessions for consistent progress across the season.',
  },
  {
    name: 'Performance',
    detail: '100m and 400m pathways with sharper volume and competition focus.',
  },
  {
    name: 'Elite',
    detail: 'High-intensity programming for athletes chasing peak race shape.',
  },
] as const

const ROLES = [
  {
    name: 'Athletes',
    detail: 'Book sessions, track attendance, log training, and read coach feedback.',
  },
  {
    name: 'Coaches',
    detail: 'Publish sessions, check athletes in, manage quotas, and leave notes.',
  },
  {
    name: 'Parents',
    detail: 'Follow linked athletes, book on their behalf, and stay on the schedule.',
  },
] as const

export default function MarketingHome({
  initialLoginOpen = false,
  passwordResetOk = false,
}: {
  initialLoginOpen?: boolean
  passwordResetOk?: boolean
}) {
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen)

  const closeLogin = useCallback(() => {
    setLoginOpen(false)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('login') && !url.searchParams.has('reset')) return
    url.searchParams.delete('login')
    url.searchParams.delete('reset')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, '', next)
  }, [])

  const openLogin = useCallback(() => {
    setLoginOpen(true)
  }, [])

  useEffect(() => {
    setLoginOpen(initialLoginOpen)
  }, [initialLoginOpen])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <p className="text-sm font-semibold tracking-[0.18em] text-foreground">TrackZAN</p>
          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="hidden rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
            >
              Create account
            </Link>
            <button
              type="button"
              onClick={openLogin}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-black text-zinc-900 hover:bg-zinc-200"
            >
              Member login
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[100svh] overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(70,120,70,0.28),transparent_55%),radial-gradient(ellipse_at_80%_10%,rgba(40,80,110,0.22),transparent_45%),linear-gradient(180deg,#050505_0%,#0b0f0c_48%,#050505_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40 [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_11%,rgba(255,255,255,0.06)_11%,rgba(255,255,255,0.06)_12%)]"
          />
          <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-end px-4 pb-16 pt-28 md:px-8 md:pb-24">
            <div className="marketing-hero-rise max-w-3xl">
              <p className="text-5xl font-semibold tracking-tight text-white sm:text-7xl md:text-8xl">
                TrackZAN
              </p>
              <h1 className="mt-5 max-w-2xl text-2xl font-medium text-zinc-100 sm:text-3xl md:text-4xl">
                The Basecamp for Speed Lab training
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Hong Kong track operations for athletes, coaches, and parents — sessions, bookings, and
                feedback in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openLogin}
                  className="rounded-md bg-white px-5 py-2.5 text-sm font-black text-zinc-900 hover:bg-zinc-200"
                >
                  Member login
                </button>
                <Link
                  href="/signup"
                  className="rounded-md border border-border px-5 py-2.5 text-sm text-foreground hover:bg-accent"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="programs" className="marketing-section border-t border-border py-20 md:py-28">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Programs</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-foreground md:text-4xl">
              Training paths built for the track
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Choose the lane that matches where you are — from youth foundations to elite race prep.
            </p>
            <div className="mt-12 grid gap-10 md:grid-cols-2">
              {PROGRAMS.map((program) => (
                <div key={program.name} className="border-t border-border pt-5">
                  <h3 className="text-xl font-semibold text-foreground">{program.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{program.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="marketing-section border-t border-border bg-card/40 py-20 md:py-28">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Who trains here</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-foreground md:text-4xl">
              One club, three ways into The Basecamp
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Everyone sees what they need — without the noise of a generic sports app.
            </p>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {ROLES.map((role) => (
                <div key={role.name}>
                  <h3 className="text-lg font-semibold text-foreground">{role.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="marketing-section border-t border-border py-20 md:py-28">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contact</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-foreground md:text-4xl">
              Ready for Speed Lab training in Hong Kong?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Members sign in to book and train. New athletes can create an account to join TrackZAN.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openLogin}
                className="rounded-md bg-white px-5 py-2.5 text-sm font-black text-zinc-900 hover:bg-zinc-200"
              >
                Member login
              </button>
              <Link
                href="/signup"
                className="rounded-md border border-border px-5 py-2.5 text-sm text-foreground hover:bg-accent"
              >
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>TrackZAN · The Basecamp</p>
          <p>Hong Kong Speed Lab training</p>
        </div>
      </footer>

      <MemberLoginSidebar open={loginOpen} onClose={closeLogin} passwordResetOk={passwordResetOk} />
    </div>
  )
}
