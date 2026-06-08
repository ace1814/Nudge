import { useState, useRef, useEffect } from 'react'
import { Microphone, MicrophoneSlash, X, CircleNotch, Check, CaretRight, PencilSimple, ArrowRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const S = { STARTING: 'starting', RECORDING: 'recording', PROCESSING: 'processing', DONE: 'done', TEXT: 'text', ERROR: 'error' }

const CATEGORY_COLORS = {
  health: 'bg-emerald-500', work: 'bg-blue-500', content: 'bg-violet-500',
  personal: 'bg-amber-500', finance: 'bg-teal-500', other: 'bg-zinc-500'
}

export default function VoiceDump({ onClose, textMode = false }) {
  const [state, setState]       = useState(textMode ? S.TEXT : S.STARTING)
  const [textInput, setTextInput] = useState('')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [amplitude, setAmplitude] = useState(0)
  const [elapsed, setElapsed]   = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const analyserRef      = useRef(null)
  const animFrameRef     = useRef(null)
  const streamRef        = useRef(null)
  const timerRef         = useRef(null)

  // Auto-start recording (or open text mode) immediately on mount
  useEffect(() => {
    if (!textMode) startRecording()
    return () => {
      stopRecording()
      clearInterval(timerRef.current)
    }
  }, [])

  // Notify main process of recording state so the window doesn't hide mid-session
  useEffect(() => {
    window.nudge?.setRecording?.(state === S.RECORDING)
  }, [state])

  const startRecording = async () => {
    try {
      const granted = await window.nudge?.requestMic()
      if (!granted) {
        setError('Microphone access denied. Enable it in System Settings → Privacy → Microphone.')
        setState(S.TEXT)
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
      setError('Could not access microphone.')
      setState(S.TEXT)
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
      const res = await window.nudge?.processVoiceDump(null, textInput.trim())
      setResult(res)
      setState(S.DONE)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setState(S.ERROR)
    }
  }

  const switchToText = () => {
    stopRecording()
    setState(S.TEXT)
  }

  const switchToVoice = () => {
    setError('')
    setState(S.STARTING)
    startRecording()
  }

  const formatElapsed = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const micScale = 1 + (amplitude / 255) * 0.3

  return (
    <>
      {/* Dim backdrop */}
      <div
        className="absolute inset-0 z-40 bg-black/50 animate-fade-in-bg"
        onClick={onClose}
      />

      {/* Sheet — slides up from bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-2xl animate-slide-up max-h-[82%] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>

        {/* Top row */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-foreground">
            {state === S.STARTING   ? 'Starting…'   :
             state === S.RECORDING  ? 'Recording'    :
             state === S.PROCESSING ? 'Processing'   :
             state === S.DONE       ? 'Done'         : 'Type a task'}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">

          {/* STARTING */}
          {state === S.STARTING && (
            <div className="flex items-center justify-center py-10">
              <CircleNotch size={24} className="text-primary animate-spin" />
            </div>
          )}

          {/* RECORDING */}
          {state === S.RECORDING && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative flex items-center justify-center">
                <span
                  className="absolute rounded-full bg-destructive/15 transition-all duration-75"
                  style={{ width: `${56 + amplitude * 0.45}px`, height: `${56 + amplitude * 0.45}px` }}
                />
                <button
                  onClick={stopRecording}
                  style={{ transform: `scale(${micScale})` }}
                  className="relative z-10 w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
                >
                  <MicrophoneSlash size={22} weight="fill" className="text-white" />
                </button>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{formatElapsed(elapsed)}</p>
              <p className="text-xs text-muted-foreground">Tap to stop</p>
              <button
                onClick={switchToText}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <PencilSimple size={12} /> Type instead
              </button>
            </div>
          )}

          {/* PROCESSING */}
          {state === S.PROCESSING && (
            <div className="flex flex-col items-center gap-3 py-10">
              <CircleNotch size={26} className="text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">Parsing your plan…</p>
              <p className="text-xs text-muted-foreground">Whisper → GPT-4o</p>
            </div>
          )}

          {/* DONE */}
          {state === S.DONE && result && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-done/15 flex items-center justify-center flex-shrink-0">
                  <Check size={11} weight="bold" className="text-done" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {result.items?.filter(i => i.type !== 'context' && i.type !== 'habit').length ?? 0} nudge(s)
                  {result.storedHabits?.length > 0 && `, ${result.storedHabits.length} habit(s)`} created.
                </p>
              </div>

              {result.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
              )}

              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {result.items?.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-background border border-border">
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', CATEGORY_COLORS[item.category] ?? 'bg-zinc-500')} />
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
                Done <CaretRight size={13} weight="bold" />
              </Button>
            </div>
          )}

          {/* TEXT / ERROR */}
          {(state === S.TEXT || state === S.ERROR) && state !== S.PROCESSING && state !== S.DONE && (
            <div className="flex flex-col gap-3 py-2">
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <Textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Remind me to call the dentist at 3pm, pick up groceries, follow up with John…"
                className="h-24"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTextSubmit() }}
              />
              <Button onClick={handleTextSubmit} disabled={!textInput.trim()} className="w-full gap-1.5">
                <ArrowRight size={13} weight="bold" /> Parse this
              </Button>
              {state !== S.ERROR && (
                <button
                  onClick={switchToVoice}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Microphone size={12} /> Use voice instead
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
