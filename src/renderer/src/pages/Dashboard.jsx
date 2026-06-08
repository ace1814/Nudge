import { useState, useEffect, useCallback } from 'react'
import { Mic, Droplets, Plus, Minus, TrendingUp } from 'lucide-react'
import dayjs from 'dayjs'
import NudgeCard from '@/components/NudgeCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export default function Dashboard({ onOpenVoiceDump }) {
  const [todayEntry, setTodayEntry] = useState(null)
  const [nudges, setNudges] = useState([])
  const [waterCount, setWaterCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [entry, todayNudges] = await Promise.all([
        window.nudge?.getTodayEntry()?.catch(() => null) ?? Promise.resolve(null),
        window.nudge?.getTodayNudges()?.catch(() => []) ?? Promise.resolve([])
      ])
      setTodayEntry(entry)
      setNudges(todayNudges || [])
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
    .slice(0, 3)

  const missed = nudges.filter(n => n.status === 'missed')
  const done = nudges.filter(n => n.status === 'done')
  const hasWater = nudges.some(n => n.category === 'health' && n.title.toLowerCase().includes('water'))

  const handleComplete = async (id) => { await window.nudge?.completeNudge(id); load() }
  const handleSnooze = async (id, mins) => { await window.nudge?.snoozeNudge(id, mins); load() }
  const handleDismiss = async (id) => { await window.nudge?.dismissNudge(id); load() }

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
      <div className="px-4 pt-5 pb-4">
        <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
          {dayjs().format('dddd, D MMMM')}
        </p>
        <h1 className="text-xl font-semibold text-foreground mt-1">{greeting()}</h1>

        {nudges.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <Stat label="Due" value={upcoming.length} color="text-pending" />
            <Stat label="Done" value={done.length} color="text-done" />
            <Stat label="Missed" value={missed.length} color="text-missed" />
          </div>
        )}
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Day summary / voice dump prompt */}
        {todayEntry?.parsed_summary ? (
          <div className="text-sm text-muted-foreground leading-relaxed px-0.5">
            {todayEntry.parsed_summary}
          </div>
        ) : (
          <button
            onClick={onOpenVoiceDump}
            className="flex items-center gap-3 w-full px-4 py-4 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Mic size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">What's the plan today?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tap to voice dump</p>
            </div>
          </button>
        )}

        {/* Upcoming nudges */}
        {upcoming.length > 0 && (
          <Section title="Up next">
            {upcoming.map(n => (
              <NudgeCard key={n.id} nudge={n} onComplete={handleComplete} onSnooze={handleSnooze} onDismiss={handleDismiss} />
            ))}
          </Section>
        )}

        {/* Water tracker */}
        {hasWater && (
          <Card>
            <CardContent className="pt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Droplets size={16} className="text-blue-400" />
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
              <NudgeCard key={n.id} nudge={n} onComplete={handleComplete} onSnooze={handleSnooze} onDismiss={handleDismiss} />
            ))}
          </Section>
        )}

        {/* Empty with plan */}
        {nudges.length === 0 && todayEntry && (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
            <TrendingUp size={24} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">All clear.</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Nudges appear as the day goes on.</p>
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
