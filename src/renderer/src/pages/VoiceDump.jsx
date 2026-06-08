import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, X, Loader2, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const S = { IDLE: 'idle', RECORDING: 'recording', PROCESSING: 'processing', DONE: 'done', ERROR: 'error' }

const CATEGORY_COLORS = {
  health: 'bg-emerald-500', work: 'bg-blue-500', content: 'bg-violet-500',
  personal: 'bg-amber-500', finance: 'bg-teal-500', other: 'bg-zinc-500'
}

export default function VoiceDump({ onClose }) {
  const [state, setState] = useState(S.IDLE)
  const [textInput, setTextInput] = useState('')
  const [useText, setUseText] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [amplitude, setAmplitude] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => () => { stopRecording(); clearInterval(timerRef.current) }, [])

  const startRecording = async () => {
    try {
      // Check / request macOS mic permission first
      const granted = await window.nudge?.requestMic()
      if (granted === false) {
        setError('Microphone access denied. Go to System Settings → Privacy & Security → Microphone and enable Electron.')
        setUseText(true)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser

      const track = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        setAmplitude(data.reduce((a, b) => a + b, 0) / data.length)
        animFrameRef.current = requestAnimationFrame(track)
      }
      track()

      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = handleStop
      recorder.start()
      mediaRecorderRef.current = recorder

      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      setState(S.RECORDING)
    } catch {
      setError('Mic access denied.')
      setUseText(true)
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    setAmplitude(0)
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const handleStop = async () => {
    setState(S.PROCESSING)
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const res = await window.nudge?.processVoiceDump(arrayBuffer)
      setResult(res)
      setState(S.DONE)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setState(S.ERROR)
    }
  }

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return
    setState(S.PROCESSING)
    try {
      const res = await window.nudge?.processVoiceDump(null, textInput) ?? null
      setResult(res)
      setState(S.DONE)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setState(S.ERROR)
    }
  }

  const formatElapsed = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const micScale = 1 + (amplitude / 255) * 0.35

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background animate-fade-up">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Voice Dump</h2>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* IDLE */}
        {state === S.IDLE && !useText && (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Talk freely.</p>
              <p className="text-xs text-muted-foreground mt-1">Plans, tasks, reminders — anything. Nudge figures the rest out.</p>
            </div>

            <div className="relative flex items-center justify-center">
              {/* Ambient rings */}
              <span className="absolute w-24 h-24 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
              <span className="absolute w-20 h-20 rounded-full border border-primary/15" />
              <button
                onClick={startRecording}
                className="relative z-10 w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Mic size={24} className="text-primary-foreground" />
              </button>
            </div>

            <button onClick={() => setUseText(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
              Type instead
            </button>
          </>
        )}

        {/* RECORDING */}
        {state === S.RECORDING && (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Listening...</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{formatElapsed(elapsed)}</p>
            </div>

            <div className="relative flex items-center justify-center">
              {/* Live amplitude ring */}
              <span
                className="absolute rounded-full bg-primary/10 transition-transform duration-75"
                style={{
                  width: `${64 + amplitude * 0.4}px`,
                  height: `${64 + amplitude * 0.4}px`,
                }}
              />
              <button
                onClick={stopRecording}
                style={{ transform: `scale(${micScale})` }}
                className="relative z-10 w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
              >
                <MicOff size={22} className="text-white" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">Tap to stop & process</p>
          </>
        )}

        {/* PROCESSING */}
        {state === S.PROCESSING && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Parsing your plan...</p>
              <p className="text-xs text-muted-foreground mt-0.5">Whisper → GPT-4o</p>
            </div>
          </div>
        )}

        {/* DONE */}
        {state === S.DONE && result && (
          <div className="w-full flex flex-col gap-3 animate-fade-up">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-done/15 flex items-center justify-center">
                <Check size={11} className="text-done" />
              </div>
              <p className="text-sm font-medium text-foreground">Got it — {result.items?.filter(i => i.type !== 'context').length} nudge{result.items?.length !== 1 ? 's' : ''} created.</p>
            </div>

            {result.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
            )}

            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {result.items?.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-card border border-border">
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', item.type === 'context' ? 'bg-muted-foreground' : CATEGORY_COLORS[item.category] ?? 'bg-zinc-500')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-snug">{item.title}</p>
                    {item.nudge_copy && item.type !== 'context' && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.nudge_copy}</p>
                    )}
                  </div>
                  {item.type !== 'context' && (
                    <Badge variant={item.type === 'habit' ? 'default' : 'secondary'}>{item.type}</Badge>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={onClose} className="w-full mt-1">
              Done <ChevronRight size={14} />
            </Button>
          </div>
        )}

        {/* TEXT INPUT / ERROR */}
        {(state === S.ERROR || useText) && state !== S.PROCESSING && state !== S.DONE && (
          <div className="w-full flex flex-col gap-3 animate-fade-up">
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <Textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="I'm heading to a coffee shop, remind me to drink water, need to follow up with..."
              className="h-28"
              autoFocus
            />
            <Button onClick={handleTextSubmit} disabled={!textInput.trim()} className="w-full">
              Parse this
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}
