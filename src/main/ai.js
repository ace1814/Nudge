import OpenAI from 'openai'
import { getApiKey } from './keychain'
import { createReadStream } from 'fs'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let openaiInstance = null

async function getOpenAI() {
  if (openaiInstance) return openaiInstance
  const key = await getApiKey('openai')
  if (!key) throw new Error('OpenAI API key not set. Go to Settings to add it.')
  openaiInstance = new OpenAI({ apiKey: key })
  return openaiInstance
}

export function resetOpenAI() {
  openaiInstance = null
}

// ─── Transcribe audio blob → raw text ────────────────────────────────────────

export async function transcribeAudio(audioBuffer) {
  const ai = await getOpenAI()

  // Write buffer to temp file (Whisper requires a file)
  const tmpPath = join(tmpdir(), `nudge_audio_${Date.now()}.webm`)
  writeFileSync(tmpPath, audioBuffer)

  try {
    const transcription = await ai.audio.transcriptions.create({
      file: createReadStream(tmpPath),
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    })
    return transcription
  } finally {
    try { unlinkSync(tmpPath) } catch {}
  }
}

// ─── Parse transcript → structured nudge items ───────────────────────────────

const SYSTEM_PROMPT = `You are Nudge's intent parser. Your job is to extract actionable items from a user's voice dump — a casual, stream-of-consciousness description of their day's plans.

Return ONLY a valid JSON object with this exact schema:
{
  "summary": "2–3 sentence summary of the day's plan",
  "items": [
    {
      "type": "nudge" | "task" | "habit" | "context",
      "title": "short action title",
      "category": "health" | "work" | "content" | "personal" | "finance" | "other",
      "scheduled_for": "ISO 8601 datetime string (pick a reasonable time today if not specified)",
      "recurrence": null | "hourly" | "daily" | "every_2h" | "every_90m" | "weekly",
      "recurrence_window_start": "HH:MM" | null,
      "recurrence_window_end": "HH:MM" | null,
      "nudge_copy": "the exact notification text to show the user — conversational, not generic",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Rules:
- "context" type = informational only, no nudge fires (e.g. "going to coffee shop")
- "task" type = one-time thing, fires once
- "nudge" type = time-sensitive reminder, fires once
- "habit" type = anything the user wants to do regularly (daily swim, meditation, journaling, water, workouts). If recurrence is daily/weekly/every_Xh, ALWAYS use "habit" not "nudge"
- For water / hydration: use recurrence "every_2h", window 09:00–21:00
- For vlogging/content: schedule between 17:00–19:00
- For work tasks with no time: schedule between 10:00–12:00
- For end-of-day things: schedule at 20:00
- Tomorrow items: set scheduled_for to tomorrow at a reasonable time
- nudge_copy must be personal and contextual — reference what the user said
- If timing is genuinely ambiguous, set confidence to "medium" or "low"
- Today's date: ${new Date().toISOString()}`

export async function parseTranscript(transcript) {
  const ai = await getOpenAI()

  const response = await ai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Voice dump transcript:\n\n"${transcript}"` }
    ],
    temperature: 0.3,
    max_tokens: 1500
  })

  const raw = response.choices[0].message.content
  const parsed = JSON.parse(raw)
  return parsed
}

// ─── Generate nudge copy for habits ──────────────────────────────────────────

const CONTENT_PROMPTS = [
  "What was the most interesting thing that happened today?",
  "You're building something cool. Did you capture any of it?",
  "30 seconds. What would you want to remember about today?",
  "Something happened today worth telling. What was it?",
  "What made today different from yesterday?",
  "If you were to post one thing from today, what would it be?"
]

export function getContentPrompt(lastIndex = -1) {
  let index
  do {
    index = Math.floor(Math.random() * CONTENT_PROMPTS.length)
  } while (index === lastIndex && CONTENT_PROMPTS.length > 1)
  return { text: CONTENT_PROMPTS[index], index }
}
