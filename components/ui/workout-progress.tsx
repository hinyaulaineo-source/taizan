'use client'

type ProgressProps = { value: number }

export function WorkoutProgressRing({ value }: ProgressProps) {
  const v = Math.max(0, Math.min(100, value))
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (v / 100) * circumference

  return (
    <div className="relative h-28 w-28">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="url(#grad)"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff2a3d" />
            <stop offset="100%" stopColor="#f4c95d" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-white">{v}%</div>
    </div>
  )
}

export function WorkoutProgressBar({ value }: ProgressProps) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>Completion</span>
        <span>{v}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: 'linear-gradient(90deg,#ff2a3d,#f4c95d)' }}
        />
      </div>
    </div>
  )
}
