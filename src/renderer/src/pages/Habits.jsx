import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const FREQUENCIES = ['daily', 'weekdays', 'weekends']
const TONES = ['gentle', 'firm', 'blunt']
const emptyHabit = { name: '', frequency: 'daily', time_window: '08:00-22:00', nudge_tone: 'gentle', active: true }

export default function Habits() {
  const [habits, setHabits] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyHabit)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setHabits(await window.nudge?.getHabits() || [])
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await window.nudge?.upsertHabit(form)
      setForm(emptyHabit); setAdding(false); load()
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Habits</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Always on, no re-entry needed</p>
        </div>
        <Button size="icon-sm" onClick={() => setAdding(!adding)}>
          <Plus size={14} />
        </Button>
      </div>

      <Separator />

      {/* Add form */}
      {adding && (
        <div className="mx-4 mt-3">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-3">
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Daily journaling"
                autoFocus
              />

              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">Frequency</p>
                <div className="flex gap-1">
                  {FREQUENCIES.map(f => (
                    <button key={f} onClick={() => setForm(ff => ({ ...ff, frequency: f }))}
                      className={cn('flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors border',
                        form.frequency === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-primary/30')}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">Nudge tone</p>
                <div className="flex gap-1">
                  {TONES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, nudge_tone: t }))}
                      className={cn('flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors border',
                        form.nudge_tone === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-primary/30')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => { setAdding(false); setForm(emptyHabit) }}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? 'Saving...' : 'Add habit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {habits.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-12 text-center">
            <p className="text-sm text-muted-foreground">No habits yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add one to run it daily without re-entry.</p>
          </div>
        )}

        {habits.map(h => (
          <Card key={h.id} className={cn(!h.active && 'opacity-50')}>
            <CardContent className="flex items-center gap-3 pt-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{h.frequency} · {h.nudge_tone}</p>
              </div>
              <Switch
                checked={h.active}
                onCheckedChange={async (v) => { await window.nudge?.upsertHabit({ ...h, active: v }); load() }}
              />
              <Button size="icon-sm" variant="ghost"
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={async () => { await window.nudge?.deleteHabit(h.id); load() }}>
                <Trash size={13} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
