import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, Shield, Wifi, WifiOff, Loader2, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'

const TONES = [
  { id: 'gentle', label: 'Gentle', desc: 'Soft, no pressure' },
  { id: 'firm',   label: 'Firm',   desc: 'Clear and direct' },
  { id: 'blunt',  label: 'Blunt',  desc: 'No fluff, just the ask' }
]

export default function Settings({ onConfigured }) {
  const [settings, setSettings] = useState(null)
  const [openaiKey, setOpenaiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keySet, setKeySet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dbStatus, setDbStatus] = useState(null) // null | 'testing' | { ok, error }

  useEffect(() => {
    const defaults = {
      morning_brief_time: '08:00',
      silent_hours: { start: '22:30', end: '08:00' },
      content_nudge_window: { start: '17:00', end: '19:00' },
      nudge_tone: 'gentle',
      supabase: { url: '', key: '' }
    }
    Promise.all([
      window.nudge?.getSettings().catch(() => null),
      window.nudge?.getOpenAIKeySet().catch(() => false)
    ]).then(([s, set]) => {
      setSettings(s ?? defaults)
      setKeySet(set ?? false)
    }).catch(() => setSettings(defaults))
  }, [])

  const update = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  const testConnection = async () => {
    setDbStatus('testing')
    // Save first so the test uses the latest values
    if (settings?.supabase?.url && settings?.supabase?.key) {
      await window.nudge?.saveSettings({ supabase: settings.supabase })
    }
    const result = await window.nudge?.testSupabase()
    setDbStatus(result ?? { ok: false, error: 'No response from main process.' })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (openaiKey.trim()) {
        await window.nudge?.setOpenAIKey(openaiKey.trim())
        setKeySet(true); setOpenaiKey(''); onConfigured?.()
      }
      if (settings) await window.nudge?.saveSettings(settings)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  if (!settings) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-base font-semibold text-foreground">Settings</h1>
      </div>
      <Separator />

      <div className="flex flex-col gap-5 px-4 pt-4">

        {/* OpenAI Key */}
        <Section title="OpenAI" icon={<Shield size={11} />}>
          {keySet && (
            <div className="flex items-center gap-1.5 text-[11px] text-done mb-2">
              <Check size={11} /> Stored in macOS Keychain
            </div>
          )}
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder={keySet ? 'Replace existing key...' : 'sk-proj-...'}
              className="pr-9"
            />
            <button onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Never stored in the database. Keychain only.</p>
        </Section>

        {/* Supabase */}
        <Section title="Supabase">
          <Input
            value={settings.supabase?.url || ''}
            onChange={e => update('supabase', { ...settings.supabase, url: e.target.value })}
            placeholder="https://xxxx.supabase.co"
            className="mb-2"
          />
          <Input
            type="password"
            value={settings.supabase?.key || ''}
            onChange={e => update('supabase', { ...settings.supabase, key: e.target.value })}
            placeholder="service_role key"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">Use the service_role key, not anon.</p>

          <button
            onClick={testConnection}
            disabled={dbStatus === 'testing'}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 disabled:opacity-50"
          >
            {dbStatus === 'testing'
              ? <Loader2 size={11} className="animate-spin" />
              : <Wifi size={11} />}
            Test connection
          </button>

          {dbStatus && dbStatus !== 'testing' && (
            <div className={cn(
              'flex items-start gap-2 px-3 py-2 rounded-lg text-xs mt-1',
              dbStatus.ok ? 'bg-done/10 text-done' : 'bg-destructive/10 text-destructive'
            )}>
              {dbStatus.ok
                ? <><Check size={11} className="mt-0.5 flex-shrink-0" /> All tables found. Supabase is connected.</>
                : <><WifiOff size={11} className="mt-0.5 flex-shrink-0" /> <span>{dbStatus.error}</span></>
              }
            </div>
          )}
        </Section>

        {/* Timing */}
        <Section title="Timing">
          <TimeRow label="Morning brief" value={settings.morning_brief_time}
            onChange={v => update('morning_brief_time', v)} />
          <TimeRangeRow label="Content nudge window"
            start={settings.content_nudge_window?.start} end={settings.content_nudge_window?.end}
            onStartChange={v => update('content_nudge_window', { ...settings.content_nudge_window, start: v })}
            onEndChange={v => update('content_nudge_window', { ...settings.content_nudge_window, end: v })} />
          <TimeRangeRow label="Silent hours"
            start={settings.silent_hours?.start} end={settings.silent_hours?.end}
            onStartChange={v => update('silent_hours', { ...settings.silent_hours, start: v })}
            onEndChange={v => update('silent_hours', { ...settings.silent_hours, end: v })} />
        </Section>

        {/* Test notification */}
        <Section title="Notifications">
          <button
            onClick={() => window.nudge?.fireTestNotification()}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors w-full text-left"
          >
            <Bell size={14} className="text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Fire test nudge</p>
              <p className="text-xs text-muted-foreground">See exactly how a notification looks</p>
            </div>
          </button>
        </Section>

        {/* Nudge tone */}
        <Section title="Nudge Tone">
          <div className="flex flex-col gap-1.5">
            {TONES.map(t => (
              <button key={t.id} onClick={() => update('nudge_tone', t.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                  settings.nudge_tone === t.id ? 'border-primary bg-primary/8' : 'border-border bg-card hover:border-primary/30'
                )}>
                <div className={cn('w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all',
                  settings.nudge_tone === t.id ? 'border-primary bg-primary' : 'border-muted-foreground')} />
                <div>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

      </div>

      {/* Fixed save */}
      <div className="fixed bottom-14 left-0 right-0 px-4 pb-3 pt-2 bg-background border-t border-border">
        <Button
          onClick={handleSave}
          disabled={saving}
          variant={saved ? 'success' : 'default'}
          className="w-full"
        >
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
      </div>
      {children}
    </div>
  )
}

function TimeRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-foreground">{label}</span>
      <input type="time" value={value} onChange={e => onChange(e.target.value)}
        className="px-2 py-1 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  )
}

function TimeRangeRow({ label, start, end, onStartChange, onEndChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="time" value={start} onChange={e => onStartChange(e.target.value)}
          className="px-2 py-1 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        <span className="text-[11px] text-muted-foreground">–</span>
        <input type="time" value={end} onChange={e => onEndChange(e.target.value)}
          className="px-2 py-1 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
    </div>
  )
}
