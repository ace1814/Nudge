import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import VoiceDump from './pages/VoiceDump'
import Settings from './pages/Settings'
import Habits from './pages/Habits'
import NotificationCentre from './pages/NotificationCentre'
import NavBar from './components/NavBar'
import SetupBanner from './components/SetupBanner'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [voiceDumpOpen, setVoiceDumpOpen] = useState(false)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    // Listen for main process events
    window.nudge?.on('open-voice-dump', () => setVoiceDumpOpen(true))
    window.nudge?.subscribeRealtime()

    // Check if keys are configured
    window.nudge?.getOpenAIKeySet().then(set => {
      if (!set) setConfigured(false)
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {!configured && (
        <SetupBanner onGoToSettings={() => setPage('settings')} />
      )}

      <div className="flex-1 overflow-hidden">
        {page === 'dashboard' && (
          <Dashboard onOpenVoiceDump={() => setVoiceDumpOpen(true)} />
        )}
        {page === 'nudges' && <NotificationCentre />}
        {page === 'habits' && <Habits />}
        {page === 'settings' && <Settings onConfigured={() => setConfigured(true)} />}
      </div>

      <NavBar current={page} onChange={setPage} onMic={() => setVoiceDumpOpen(true)} />

      {voiceDumpOpen && (
        <VoiceDump onClose={() => setVoiceDumpOpen(false)} />
      )}
    </div>
  )
}
