import { ipcMain } from 'electron'
import Store from 'electron-store'
import { transcribeAudio, parseTranscript } from './ai'
import { setApiKey, getApiKey, setSupabaseConfig, getSupabaseConfig } from './keychain'
import { resetOpenAI } from './ai'
import { resetSupabase, getSupabase } from './supabase'
import {
  upsertDay, insertNudges, getTodayNudges, getTodayEntry,
  updateNudgeStatus, snoozeNudge, recordCompletion,
  getActiveHabits, upsertHabit, deleteHabit,
  getSetting, setSetting
} from './supabase'
import { rescheduleAll } from './scheduler'

const store = new Store()

export function setupIpcHandlers(mainWindow) {

  // ─── Voice processing ────────────────────────────────────────────────────

  ipcMain.handle('transcribe-audio', async (_, audioBuffer) => {
    const transcript = await transcribeAudio(Buffer.from(audioBuffer))
    return transcript
  })

  ipcMain.handle('parse-transcript', async (_, transcript) => {
    const result = await parseTranscript(transcript)
    return result
  })

  ipcMain.handle('process-voice-dump', async (_, audioBuffer, textFallback) => {
    try {
      // If text was typed instead of recorded, skip Whisper
      let transcript
      if (textFallback) {
        transcript = textFallback
      } else if (audioBuffer) {
        transcript = await transcribeAudio(Buffer.from(audioBuffer))
      } else {
        throw new Error('No audio or text provided.')
      }

      const parsed = await parseTranscript(transcript)

      // Store day — throws with a clear message if Supabase isn't set up
      let day = null
      try {
        day = await upsertDay(transcript, parsed.summary)
      } catch (dbErr) {
        // Surface the real error so the user knows what to fix
        throw new Error(`Supabase error: ${dbErr.message || JSON.stringify(dbErr)}`)
      }

      const nudgeRows = parsed.items
        .filter(item => item.type !== 'context')
        .map(item => ({
          day_id: day?.id ?? null,
          title: item.title,
          type: item.type,
          category: item.category,
          scheduled_for: item.scheduled_for,
          recurrence: item.recurrence || null,
          recurrence_window_start: item.recurrence_window_start || null,
          recurrence_window_end: item.recurrence_window_end || null,
          nudge_copy: item.nudge_copy,
          status: 'pending'
        }))

      let stored = []
      if (day) {
        try {
          stored = nudgeRows.length > 0 ? await insertNudges(nudgeRows) : []
        } catch (dbErr) {
          console.warn('Could not insert nudges:', dbErr.message)
        }
      }

      return { transcript, summary: parsed.summary, items: parsed.items, stored }
    } catch (err) {
      // Serialize the error properly so IPC doesn't swallow it
      throw new Error(err?.message || err?.error_description || JSON.stringify(err) || 'Unknown error')
    }
  })

  // ─── Day / nudges ────────────────────────────────────────────────────────

  ipcMain.handle('get-today-entry', async () => getTodayEntry())
  ipcMain.handle('get-today-nudges', async () => getTodayNudges())

  ipcMain.handle('complete-nudge', async (_, id, note) => {
    await recordCompletion(id, note)
    return true
  })

  ipcMain.handle('snooze-nudge', async (_, id, minutes) => {
    await snoozeNudge(id, minutes)
    return true
  })

  ipcMain.handle('dismiss-nudge', async (_, id) => {
    await updateNudgeStatus(id, 'missed')
    return true
  })

  // ─── Habits ──────────────────────────────────────────────────────────────

  ipcMain.handle('get-habits', async () => getActiveHabits())
  ipcMain.handle('upsert-habit', async (_, habit) => upsertHabit(habit))
  ipcMain.handle('delete-habit', async (_, id) => deleteHabit(id))

  // ─── Settings ────────────────────────────────────────────────────────────

  ipcMain.handle('get-settings', async () => {
    return {
      morning_brief_time: store.get('morning_brief_time', '08:00'),
      silent_hours: store.get('silent_hours', { start: '22:30', end: '08:00' }),
      content_nudge_window: store.get('content_nudge_window', { start: '17:00', end: '19:00' }),
      nudge_tone: store.get('nudge_tone', 'gentle'),
      supabase: getSupabaseConfig()
    }
  })

  ipcMain.handle('save-settings', async (_, settings) => {
    if (settings.morning_brief_time) store.set('morning_brief_time', settings.morning_brief_time)
    if (settings.silent_hours) store.set('silent_hours', settings.silent_hours)
    if (settings.content_nudge_window) store.set('content_nudge_window', settings.content_nudge_window)
    if (settings.nudge_tone) store.set('nudge_tone', settings.nudge_tone)

    if (settings.supabase?.url || settings.supabase?.key) {
      setSupabaseConfig(settings.supabase.url || '', settings.supabase.key || '')
      resetSupabase() // force re-init with cleaned URL on next use
    }

    rescheduleAll(mainWindow)
    return true
  })

  ipcMain.handle('set-openai-key', async (_, key) => {
    await setApiKey('openai', key)
    resetOpenAI()
    return true
  })

  ipcMain.handle('get-openai-key-set', async () => {
    const key = await getApiKey('openai')
    return !!key
  })

  // ─── Test notification ───────────────────────────────────────────────────

  ipcMain.handle('fire-test-notification', async () => {
    const { Notification } = await import('electron')

    const n = new Notification({
      title: 'Have you recorded today? You mentioned you wanted to.',
      body: 'This is what a Nudge looks like. Tap Done or snooze it.',
      actions: [
        { type: 'button', text: 'Done ✓' },
        { type: 'button', text: 'Snooze 1hr' }
      ],
      closeButtonText: 'Dismiss'
    })

    n.on('action', (_, index) => {
      const reply = new Notification({
        title: index === 0 ? 'Nice. Marked as done.' : 'Snoozed for an hour.',
        silent: true
      })
      reply.show()
    })

    n.show()
    return true
  })

  // ─── Supabase connection test ────────────────────────────────────────────

  ipcMain.handle('test-supabase', async () => {
    resetSupabase()

    const Store = require('electron-store')
    const s = new Store()
    const url = (s.get('supabase_url') || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth|storage|realtime)(\/.*)?$/, '')
    const key = (s.get('supabase_service_key') || '').trim()

    if (!url || !key) {
      return { ok: false, error: 'No URL or key stored. Save settings first.' }
    }

    // 1. Raw fetch test — bypasses supabase-js entirely
    try {
      const res = await fetch(`${url}/rest/v1/days?select=id&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      })
      const body = await res.text()
      console.log('[raw fetch] status:', res.status, 'body:', body.slice(0, 200))
      if (!res.ok) {
        return { ok: false, error: `Raw fetch failed (${res.status}): ${body.slice(0, 300)}` }
      }
    } catch (fetchErr) {
      return { ok: false, error: `Network error: ${fetchErr.message}` }
    }

    // 2. Supabase client test
    const db = getSupabase()
    if (!db) return { ok: false, error: 'Supabase client failed to initialize.' }

    try {
      const tableColumns = { days: 'id', nudges: 'id', habits: 'id', completions: 'id', settings: 'key' }
      for (const [table, col] of Object.entries(tableColumns)) {
        const { error } = await db.from(table).select(col).limit(1)
        if (error) return { ok: false, error: `Table "${table}": ${error.message} (${error.code})` }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // ─── Mic permission ─────────────────────────────────────────────────────

  ipcMain.handle('get-mic-status', async () => {
    if (process.platform !== 'darwin') return 'granted'
    const { systemPreferences } = await import('electron')
    return systemPreferences.getMediaAccessStatus('microphone')
  })

  ipcMain.handle('request-mic', async () => {
    if (process.platform !== 'darwin') return true
    const { systemPreferences } = await import('electron')
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') return true
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return granted
  })

  // ─── Realtime subscription ───────────────────────────────────────────────

  ipcMain.handle('subscribe-realtime', async () => {
    const db = getSupabase()
    if (!db) return false

    db.channel('nudges-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nudges' }, (payload) => {
        mainWindow.webContents.send('realtime-nudge-change', payload)
      })
      .subscribe()

    return true
  })
}
