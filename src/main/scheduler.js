import cron from 'node-cron'
import { Notification } from 'electron'
import Store from 'electron-store'
import { getTodayNudges, getActiveHabits, updateNudgeStatus, snoozeNudge, insertNudges } from './supabase'
import { getContentPrompt } from './ai'

const store = new Store()

let tasks = []
let nudgeCheckTask = null
let morningBriefTask = null
let contentNudgeTask = null

export function startScheduler(mainWindow) {
  // Check every minute for pending nudges
  nudgeCheckTask = cron.schedule('* * * * *', () => checkPendingNudges(mainWindow))

  // Morning brief — default 8:00 AM
  scheduleMorningBrief(mainWindow)

  // Content nudge — default 5:30 PM
  scheduleContentNudge(mainWindow)
}

export function rescheduleAll(mainWindow) {
  tasks.forEach(t => t.stop())
  tasks = []
  nudgeCheckTask?.stop()
  morningBriefTask?.stop()
  contentNudgeTask?.stop()
  startScheduler(mainWindow)
}

// ─── Morning brief ───────────────────────────────────────────────────────────

function scheduleMorningBrief(mainWindow) {
  const time = store.get('morning_brief_time', '08:00')
  const [hour, minute] = time.split(':')

  morningBriefTask = cron.schedule(`${minute} ${hour} * * *`, () => {
    fireMorningBrief(mainWindow)
  })
}

function fireMorningBrief(mainWindow) {
  const silentUntil = getSilentWindowEnd()
  if (isSilentNow(silentUntil)) return

  const notification = new Notification({
    title: 'Hey — what\'s the plan today?',
    body: 'Tap to tell me, or open the app to type it out.',
    actions: [
      { type: 'button', text: 'Tell me' },
      { type: 'button', text: 'Snooze 30 min' }
    ],
    closeButtonText: 'Dismiss'
  })

  notification.on('action', (_, index) => {
    if (index === 0) {
      // Open voice dump
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('open-voice-dump')
    } else if (index === 1) {
      // Snooze 30 min
      setTimeout(() => fireMorningBrief(mainWindow), 30 * 60 * 1000)
    }
  })

  notification.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  notification.show()

  // Soft re-surface at 10 AM if ignored
  const now = new Date()
  const tenAM = new Date(now)
  tenAM.setHours(10, 0, 0, 0)
  if (now < tenAM) {
    const delay = tenAM - now
    setTimeout(() => fireSoftMorningBrief(mainWindow), delay)
  }
}

function fireSoftMorningBrief(mainWindow) {
  const notification = new Notification({
    title: 'Still want to tell me about today?',
    body: 'Open Nudge whenever you\'re ready.',
    silent: true
  })
  notification.on('click', () => { mainWindow.show(); mainWindow.focus() })
  notification.show()
}

// ─── Content nudge ───────────────────────────────────────────────────────────

function scheduleContentNudge(mainWindow) {
  const window = store.get('content_nudge_window', { start: '17:00', end: '19:00' })
  const [hour, minute] = window.start.split(':')

  contentNudgeTask = cron.schedule(`${minute} ${hour} * * *`, () => {
    fireContentNudge(mainWindow)
  })
}

function fireContentNudge(mainWindow) {
  if (isSilentNow()) return

  const lastIndex = store.get('last_content_prompt_index', -1)
  const { text, index } = getContentPrompt(lastIndex)
  store.set('last_content_prompt_index', index)

  const notification = new Notification({
    title: text,
    body: 'Mark as recorded, or snooze an hour.',
    actions: [
      { type: 'button', text: 'Recorded' },
      { type: 'button', text: 'Nothing today' },
      { type: 'button', text: 'Snooze 1hr' }
    ]
  })

  notification.on('action', (_, actionIndex) => {
    if (actionIndex === 0) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('content-recorded')
    } else if (actionIndex === 2) {
      setTimeout(() => fireContentNudge(mainWindow), 60 * 60 * 1000)
    }
  })

  notification.show()
}

// ─── Pending nudge check ─────────────────────────────────────────────────────

async function checkPendingNudges(mainWindow) {
  if (isSilentNow()) return

  try {
    const nudges = await getTodayNudges()
    const now = new Date()

    for (const nudge of nudges) {
      if (nudge.status !== 'pending') continue

      const scheduledFor = new Date(nudge.scheduled_for)
      const snoozedUntil = nudge.snoozed_until ? new Date(nudge.snoozed_until) : null

      // Skip if snoozed
      if (snoozedUntil && now < snoozedUntil) continue

      // Fire if past scheduled time (within 2-minute window to avoid double-firing)
      const diff = now - scheduledFor
      if (diff >= 0 && diff <= 2 * 60 * 1000) {
        await fireNudge(nudge, mainWindow)
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err)
  }
}

async function fireNudge(nudge, mainWindow) {
  const notification = new Notification({
    title: nudge.title,
    body: nudge.nudge_copy || '',
    actions: [
      { type: 'button', text: 'Done' },
      { type: 'button', text: 'Snooze 1hr' }
    ]
  })

  notification.on('action', async (_, index) => {
    if (index === 0) {
      await updateNudgeStatus(nudge.id, 'done', { completed_at: new Date().toISOString() })
      mainWindow.webContents.send('nudge-updated', nudge.id)
    } else if (index === 1) {
      await snoozeNudge(nudge.id, 60)
      mainWindow.webContents.send('nudge-updated', nudge.id)
    }
  })

  notification.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  notification.show()

  // Mark as "fired" so we don't re-fire it
  await updateNudgeStatus(nudge.id, 'fired')

  // Schedule escalation after 90 min if not actioned
  setTimeout(async () => {
    const fresh = await getTodayNudges()
    const stillPending = fresh.find(n => n.id === nudge.id && (n.status === 'fired' || n.status === 'pending'))
    if (stillPending) {
      await fireEscalation(nudge, mainWindow, 1)
    }
  }, 90 * 60 * 1000)
}

async function fireEscalation(nudge, mainWindow, attempt) {
  if (attempt >= 2) {
    await updateNudgeStatus(nudge.id, 'missed')
    mainWindow.webContents.send('nudge-updated', nudge.id)
    return
  }

  const notification = new Notification({
    title: `Still: ${nudge.title}`,
    body: 'Just a nudge — did you get to this?',
    actions: [
      { type: 'button', text: 'Done' },
      { type: 'button', text: 'Skip it' }
    ]
  })

  notification.on('action', async (_, index) => {
    if (index === 0) {
      await updateNudgeStatus(nudge.id, 'done', { completed_at: new Date().toISOString() })
    } else {
      await updateNudgeStatus(nudge.id, 'missed')
    }
    mainWindow.webContents.send('nudge-updated', nudge.id)
  })

  notification.show()

  setTimeout(async () => {
    const fresh = await getTodayNudges()
    const stillPending = fresh.find(n => n.id === nudge.id && (n.status === 'fired' || n.status === 'pending'))
    if (stillPending) {
      await fireEscalation(nudge, mainWindow, attempt + 1)
    }
  }, 90 * 60 * 1000)
}

// ─── Silent hours ─────────────────────────────────────────────────────────────

function isSilentNow() {
  const silent = store.get('silent_hours', { start: '22:30', end: '08:00' })
  const now = new Date()
  const [startH, startM] = silent.start.split(':').map(Number)
  const [endH, endM] = silent.end.split(':').map(Number)
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const startMins = startH * 60 + startM
  const endMins = endH * 60 + endM

  if (startMins > endMins) {
    // Overnight window (e.g. 22:30 – 08:00)
    return currentMins >= startMins || currentMins < endMins
  }
  return currentMins >= startMins && currentMins < endMins
}

function getSilentWindowEnd() {
  return store.get('silent_hours', { start: '22:30', end: '08:00' }).end
}
