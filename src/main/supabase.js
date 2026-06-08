import { createClient } from '@supabase/supabase-js'
import Store from 'electron-store'
import ws from 'ws'

const store = new Store()

let supabaseInstance = null

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance

  const url = (store.get('supabase_url') || '').trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|realtime)(\/.*)?$/, '')
  const key = (store.get('supabase_service_key') || '').trim()

  if (!url || !key) return null

  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws },
    db: { schema: 'public' },
    global: {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  })

  return supabaseInstance
}

export function resetSupabase() {
  supabaseInstance = null
}

// ─── Days ────────────────────────────────────────────────────────────────────

export async function getTodayEntry() {
  const db = getSupabase()
  if (!db) return null

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await db
    .from('days')
    .select('*')
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertDay(rawTranscript, parsedSummary) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await db
    .from('days')
    .upsert({ date: today, raw_transcript: rawTranscript, parsed_summary: parsedSummary }, { onConflict: 'date' })
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Nudges ──────────────────────────────────────────────────────────────────

export async function getTodayNudges() {
  const db = getSupabase()
  if (!db) return []

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const { data, error } = await db
    .from('nudges')
    .select('*')
    .gte('scheduled_for', today)
    .lt('scheduled_for', tomorrow)
    .order('scheduled_for')

  if (error) throw error
  return data || []
}

export async function insertNudges(nudges) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const { data, error } = await db.from('nudges').insert(nudges).select()
  if (error) throw error
  return data
}

export async function updateNudgeStatus(id, status, extra = {}) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const { error } = await db
    .from('nudges')
    .update({ status, ...extra })
    .eq('id', id)

  if (error) throw error
}

export async function snoozeNudge(id, minutes = 60) {
  const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  await updateNudgeStatus(id, 'snoozed', { snoozed_until: snoozedUntil })
}

export async function deleteNudge(id) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')
  const { error } = await db.from('nudges').delete().eq('id', id)
  if (error) throw error
}

// ─── Habits ──────────────────────────────────────────────────────────────────

export async function getActiveHabits() {
  const db = getSupabase()
  if (!db) return []

  const { data, error } = await db
    .from('habits')
    .select('*')
    .eq('active', true)
    .order('created_at')

  if (error) throw error
  return data || []
}

export async function upsertHabit(habit) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const { data, error } = await db.from('habits').upsert(habit).select().single()
  if (error) throw error
  return data
}

export async function deleteHabit(id) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const { error } = await db.from('habits').delete().eq('id', id)
  if (error) throw error
}

// ─── Completions ─────────────────────────────────────────────────────────────

export async function recordCompletion(nudgeId, note = '') {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const { error } = await db
    .from('completions')
    .insert({ nudge_id: nudgeId, note, completed_at: new Date().toISOString() })

  if (error) throw error
  await updateNudgeStatus(nudgeId, 'done', { completed_at: new Date().toISOString() })
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  const db = getSupabase()
  if (!db) return null

  const { data } = await db.from('settings').select('value').eq('key', key).single()
  return data?.value ?? null
}

export async function setSetting(key, value) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase not configured')

  const { error } = await db
    .from('settings')
    .upsert({ key, value: String(value) }, { onConflict: 'key' })

  if (error) throw error
}
