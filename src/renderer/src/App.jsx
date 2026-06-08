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
  const [voiceDump, setVoiceDump] = useState(null) // null | 'voice' | 'text'
  const [configured, setConfigured] = useState(true)

  const openVoice = () => setVoiceDump('voice')
  const openText  = () => setVoiceDump('text')
  const closeVoiceDump = () => setVoiceDump(null)

  useEffect(() => {
    // Global shortcut or tray menu fires this
    window.nudge?.on('open-voice-dump', openVoice)
    window.nudge?.subscribeRealtime()

    window.nudge?.getOpenAIKeySet().then(set => {
      if (!set) setConfigured(false)
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden relative">
      {!configured && (
        <SetupBanner onGoToSettings={() => setPage('settings')} />
      )}

      <div className="flex-1 overflow-hidden">
        {page === 'dashboard' && (
          <Dashboard onOpenVoice={openVoice} onOpenText={openText} />
        )}
        {page === 'nudges' && <NotificationCentre />}
        {page === 'habits' && <Habits />}
        {page === 'settings' && <Settings onConfigured={() => setConfigured(true)} />}
      </div>

      <NavBar current={page} onChange={setPage} onMic={openVoice} />

      {voiceDump && (
        <VoiceDump
          textMode={voiceDump === 'text'}
          onClose={closeVoiceDump}
        />
      )}
    </div>
  )
}
