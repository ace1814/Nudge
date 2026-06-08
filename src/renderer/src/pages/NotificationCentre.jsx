import { useState, useEffect, useCallback } from 'react'
import NudgeCard from '@/components/NudgeCard'
import { cn } from '@/lib/utils'

const FILTERS = ['all', 'pending', 'done', 'missed', 'snoozed']

export default function NotificationCentre() {
  const [nudges, setNudges] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await window.nudge?.getTodayNudges()
    setNudges(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    window.nudge?.on('nudge-updated', load)
    window.nudge?.on('realtime-nudge-change', load)
  }, [load])

  const filtered = filter === 'all' ? nudges : nudges.filter(n => n.status === filter)

  const handle = (fn) => async (id, ...args) => { await fn(id, ...args); load() }
  const onComplete = handle((id) => window.nudge?.completeNudge(id))
  const onSnooze   = handle((id, m) => window.nudge?.snoozeNudge(id, m))
  const onDismiss  = handle((id) => window.nudge?.dismissNudge(id))

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-base font-semibold text-foreground">Nudges</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Today · {nudges.length} total</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-medium flex-shrink-0 transition-colors capitalize border',
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
        {loading && (
          <div className="flex items-center justify-center pt-12">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center pt-12">Nothing here.</p>
        )}
        {filtered.map(n => (
          <NudgeCard key={n.id} nudge={n} onComplete={onComplete} onSnooze={onSnooze} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  )
}
