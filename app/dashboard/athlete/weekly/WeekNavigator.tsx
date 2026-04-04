'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function WeekNavigator({
  weekStartIso,
  prevWeekIso,
  nextWeekIso,
  rangeLabel,
}: {
  weekStartIso: string
  prevWeekIso: string
  nextWeekIso: string
  rangeLabel: string
}) {
  const router = useRouter()

  const goToday = () => {
    router.push('/dashboard/athlete/weekly')
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground"
        onClick={() => router.push(`/dashboard/athlete/weekly?week=${prevWeekIso}`)}
      >
        <ChevronLeft size={16} />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium text-foreground">{rangeLabel}</span>
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground"
        onClick={() => router.push(`/dashboard/athlete/weekly?week=${nextWeekIso}`)}
      >
        <ChevronRight size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={goToday}
      >
        This week
      </Button>
    </div>
  )
}
