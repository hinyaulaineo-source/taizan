import { Mountain } from 'lucide-react'

export function EmptyWorkoutState() {
  return (
    <div className="glass-panel mx-auto flex min-h-[260px] max-w-xl flex-col items-center justify-center p-6 text-center">
      <Mountain className="mb-3 h-10 w-10 text-zinc-500" />
      <p className="text-sm text-zinc-400">Rest day. The Basecamp is quiet today. 🕸️</p>
    </div>
  )
}
