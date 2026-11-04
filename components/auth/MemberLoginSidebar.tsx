'use client'

import { useEffect } from 'react'
import MemberLoginForm from './MemberLoginForm'

export default function MemberLoginSidebar({
  open,
  onClose,
  passwordResetOk = false,
}: {
  open: boolean
  onClose: () => void
  passwordResetOk?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return (
    <div
      className={`fixed inset-0 z-[100] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close member login"
        onClick={onClose}
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-login-title"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p id="member-login-title" className="text-sm font-medium text-foreground">
            Member login
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2.5 py-1 text-sm text-foreground hover:bg-accent"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <MemberLoginForm passwordResetOk={passwordResetOk} />
        </div>
      </aside>
    </div>
  )
}
