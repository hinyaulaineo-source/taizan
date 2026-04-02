import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning'

const toneMap: Record<BadgeTone, string> = {
  neutral: 'border-border bg-muted text-foreground',
  success: 'border-emerald-700/60 bg-emerald-950 text-emerald-300',
  warning: 'border-amber-700/60 bg-amber-950 text-amber-300',
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: BadgeTone
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${toneMap[tone]}`}>
      {children}
    </span>
  )
}
