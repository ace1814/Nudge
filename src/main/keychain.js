import keytar from 'keytar'
import Store from 'electron-store'

const SERVICE = 'nudge-app'
const store = new Store()

export async function getApiKey(name) {
  try {
    return await keytar.getPassword(SERVICE, name)
  } catch {
    return null
  }
}

export async function setApiKey(name, value) {
  await keytar.setPassword(SERVICE, name, value)
}

export async function deleteApiKey(name) {
  await keytar.deletePassword(SERVICE, name)
}

// Supabase config lives in electron-store (not sensitive enough for keychain)
export function getSupabaseConfig() {
  return {
    url: store.get('supabase_url', ''),
    key: store.get('supabase_service_key', '')
  }
}

function cleanSupabaseUrl(url) {
  return url.trim()
    .replace(/\/+$/, '')                   // trailing slashes
    .replace(/\/(rest|auth|storage|realtime)(\/.*)?$/, '') // strip /rest/v1 etc
}

export function setSupabaseConfig(url, key) {
  store.set('supabase_url', cleanSupabaseUrl(url))
  store.set('supabase_service_key', key.trim())
}
