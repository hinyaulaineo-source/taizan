'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function MonthNavigator({
  basePath,
  prevMonthKey,
  nextMonthKey,
  label,
}: {
  basePath: string
  prevMonthKey: string
  nextMonthKey: string
  label: string
}) {
  const router = useRouter()

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground"
        onClick={() => router.push(`${basePath}?month=${prevMonthKey}`)}
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </Button>
      <span className="min-w-[160px] text-center text-sm font-medium text-foreground">{label}</span>
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground"
        onClick={() => router.push(`${basePath}?month=${nextMonthKey}`)}
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => router.push(basePath)}
      >
        This month
      </Button>
    </div>
  )
}
