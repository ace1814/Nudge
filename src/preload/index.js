import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('nudge', {
  // Voice processing
  processVoiceDump: (audioBuffer, textFallback) => ipcRenderer.invoke('process-voice-dump', audioBuffer, textFallback),
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),

  // Day / nudges
  getTodayEntry: () => ipcRenderer.invoke('get-today-entry'),
  getTodayNudges: () => ipcRenderer.invoke('get-today-nudges'),
  completeNudge: (id, note) => ipcRenderer.invoke('complete-nudge', id, note),
  snoozeNudge: (id, minutes) => ipcRenderer.invoke('snooze-nudge', id, minutes),
  dismissNudge: (id) => ipcRenderer.invoke('dismiss-nudge', id),
  deleteNudge: (id) => ipcRenderer.invoke('delete-nudge', id),

  // Habits
  getHabits: () => ipcRenderer.invoke('get-habits'),
  upsertHabit: (habit) => ipcRenderer.invoke('upsert-habit', habit),
  deleteHabit: (id) => ipcRenderer.invoke('delete-habit', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  setOpenAIKey: (key) => ipcRenderer.invoke('set-openai-key', key),
  getOpenAIKeySet: () => ipcRenderer.invoke('get-openai-key-set'),

  // Supabase test
  testSupabase: () => ipcRenderer.invoke('test-supabase'),
  fireTestNotification: () => ipcRenderer.invoke('fire-test-notification'),

  // Mic
  getMicStatus: () => ipcRenderer.invoke('get-mic-status'),
  requestMic: () => ipcRenderer.invoke('request-mic'),

  // Realtime
  subscribeRealtime: () => ipcRenderer.invoke('subscribe-realtime'),

  // Recording state → main (prevents window hiding during recording)
  setRecording: (val) => ipcRenderer.send('set-recording', val),

  // Events from main → renderer
  on: (channel, callback) => {
    const allowed = ['open-voice-dump', 'content-recorded', 'nudge-updated', 'realtime-nudge-change']
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  }
})
