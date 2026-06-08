import { useState, useEffect, useCallback } from 'react'
import { Microphone, PencilSimple, Drop, Plus, Minus, TrendUp, Check } from '@phosphor-icons/react'
import dayjs from 'dayjs'
import NudgeCard from '@/components/NudgeCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export default function Dashboard({ onOpenVoice, onOpenText }) {
  const [nudges, setNudges]         = useState([])
  const [habits, setHabits]         = useState([])
  const [doneHabits, setDoneHabits] = useState(new Set())
  const [waterCount, setWaterCount] = useState(0)
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    try {
      const [todayNudges, allHabits] = await Promise.all([
        window.nudge?.getTodayNudges()?.catch(() => []) ?? Promise.resolve([]),
        window.nudge?.getHabits()?.catch(() => []) ?? Promise.resolve([])
      ])
      setNudges(todayNudges || [])
      setHabits(allHabits || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.nudge?.on('nudge-updated', load)
    window.nudge?.on('realtime-nudge-change', load)
  }, [load])

  const upcoming = nudges
    .filter(n => n.status === 'pending' || n.status === 'fired')
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))

  const missed  = nudges.filter(n => n.status === 'missed')
  const done    = nudges.filter(n => n.status === 'done')
  const hasWater = nudges.some(n => n.category === 'health' && n.title.toLowerCase().includes('water'))

  const toggleHabit = (id) => setDoneHabits(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleComplete = async (id) => { await window.nudge?.completeNudge(id); load() }
  const handleSnooze   = async (id, mins) => { await window.nudge?.snoozeNudge(id, mins); load() }
  const handleDismiss  = async (id) => { await window.nudge?.dismissNudge(id); load() }
  const handleDelete   = async (id) => { await window.nudge?.deleteNudge(id); load() }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning.'
    if (h < 17) return 'Good afternoon.'
    return 'Good evening.'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
          {dayjs().format('dddd, D MMMM')}
        </p>
        <h1 className="text-xl font-semibold text-foreground mt-1">{greeting()}</h1>

        {nudges.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <Stat label="Due"    value={upcoming.length} color="text-pending" />
            <Stat label="Done"   value={done.length}     color="text-done" />
            <Stat label="Missed" value={missed.length}   color="text-missed" />
          </div>
        )}
      </div>

      {/* Quick entry */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={onOpenVoice}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Microphone size={14} weight="fill" /> Voice
        </button>
        <button
          onClick={onOpenText}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm font-medium hover:border-primary/40 transition-colors"
        >
          <PencilSimple size={14} /> Type a task
        </button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* Habits */}
        {habits.length > 0 && (
          <Section title="Habits">
            {habits.map(h => (
              <button
                key={h.id}
                onClick={() => toggleHabit(h.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border text-left transition-all',
                  doneHabits.has(h.id)
                    ? 'border-done/30 bg-done/8 opacity-60'
                    : 'border-border bg-card hover:border-primary/30'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                  doneHabits.has(h.id) ? 'border-done bg-done' : 'border-muted-foreground'
                )}>
                  {doneHabits.has(h.id) && <Check size={10} weight="bold" className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', doneHabits.has(h.id) ? 'line-through text-muted-foreground' : 'text-foreground')}>
                    {h.name}
                  </p>
                  {h.frequency && <p className="text-[11px] text-muted-foreground capitalize">{h.frequency}</p>}
                </div>
              </button>
            ))}
          </Section>
        )}

        {/* Upcoming nudges */}
        {upcoming.length > 0 && (
          <Section title="Up next">
            {upcoming.map(n => (
              <NudgeCard key={n.id} nudge={n} onComplete={handleComplete} onSnooze={handleSnooze} onDismiss={handleDismiss} onDelete={handleDelete} />
            ))}
          </Section>
        )}

        {/* Water tracker */}
        {hasWater && (
          <Card>
            <CardContent className="pt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Drop size={16} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Water</p>
                  <p className="text-xs text-muted-foreground">{waterCount} glass{waterCount !== 1 ? 'es' : ''} today</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon-sm" variant="ghost" onClick={() => setWaterCount(Math.max(0, waterCount - 1))}>
                    <Minus size={12} />
                  </Button>
                  <span className="text-sm font-semibold w-4 text-center">{waterCount}</span>
                  <Button size="icon-sm" variant="ghost" onClick={() => setWaterCount(waterCount + 1)}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                    <Plus size={12} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missed */}
        {missed.length > 0 && (
          <Section title="Missed today">
            {missed.map(n => (
              <NudgeCard key={n.id} nudge={n} onComplete={handleComplete} onSnooze={handleSnooze} onDismiss={handleDismiss} onDelete={handleDelete} />
            ))}
          </Section>
        )}

        {/* Empty state */}
        {nudges.length === 0 && habits.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
            <TrendUp size={24} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Tap Voice or Type above to add tasks.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('text-sm font-semibold tabular-nums', color)}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-0.5">{title}</p>
      {children}
    </div>
  )
}
