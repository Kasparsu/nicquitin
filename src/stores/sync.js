import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const SYNC_KEY   = 'niczero-sync'
const GIST_FILE  = 'niczero-data.json'

// In dev the Vite proxy forwards /api/github-oauth → github.com.
// In prod set VITE_OAUTH_PROXY_URL to your deployed Cloudflare Worker URL.
const OAUTH_BASE = import.meta.env.VITE_OAUTH_PROXY_URL ?? '/api/github-oauth'

export const useSyncStore = defineStore('sync', () => {
  const token      = ref(null)
  const gistId     = ref(null)
  const lastSynced = ref(null)
  const syncing    = ref(false)
  const error      = ref(null)

  // OAuth popup flow state
  const oauthStep = ref('idle')  // idle | waiting | done | error
  let   _oauthCleanup = null

  const isConfigured = computed(() => !!token.value)
  const hasSynced    = computed(() => !!gistId.value)

  function load() {
    const saved = localStorage.getItem(SYNC_KEY)
    if (!saved) return
    const data = JSON.parse(saved)
    token.value      = data.token      ?? null
    gistId.value     = data.gistId     ?? null
    lastSynced.value = data.lastSynced ?? null
  }

  function setToken(t) {
    token.value  = t?.trim() || null
    error.value  = null
    _persist()
  }

  function clearToken() {
    token.value      = null
    gistId.value     = null
    lastSynced.value = null
    error.value      = null
    cancelOAuth()
    localStorage.removeItem(SYNC_KEY)
  }

  function _persist() {
    localStorage.setItem(SYNC_KEY, JSON.stringify({
      token:      token.value,
      gistId:     gistId.value,
      lastSynced: lastSynced.value,
    }))
  }

  function _headers() {
    return {
      Authorization:  `Bearer ${token.value}`,
      'Content-Type': 'application/json',
      Accept:         'application/vnd.github+json',
    }
  }

  // ─── OAuth Popup Flow ──────────────────────────────────────────────────────

  function startOAuth() {
    error.value     = null
    oauthStep.value = 'waiting'

    const popup = window.open(
      `${OAUTH_BASE}/authorize`,
      'github-oauth',
      'width=600,height=700,left=200,top=100'
    )

    const workerOrigin = new URL(OAUTH_BASE).origin

    function onMessage(event) {
      if (event.origin !== workerOrigin) return
      if (event.data?.type !== 'github-oauth') return
      cleanup()
      setToken(event.data.token)
      findExistingGist().then(() => { oauthStep.value = 'done' })
    }

    const popupCheck = setInterval(() => {
      if (popup?.closed) {
        cleanup()
        if (oauthStep.value === 'waiting') oauthStep.value = 'idle'
      }
    }, 500)

    function cleanup() {
      window.removeEventListener('message', onMessage)
      clearInterval(popupCheck)
      _oauthCleanup = null
    }

    window.addEventListener('message', onMessage)
    _oauthCleanup = cleanup
  }

  function cancelOAuth() {
    if (_oauthCleanup) _oauthCleanup()
    oauthStep.value = 'idle'
  }

  // ─── Gist Discovery ────────────────────────────────────────────────────────

  // After connecting on a new device, search for an existing NicZero gist so
  // we reuse it instead of creating a duplicate.
  async function findExistingGist() {
    if (!token.value || gistId.value) return
    try {
      let page = 1
      while (true) {
        const res = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
          headers: _headers(),
        })
        if (!res.ok) return
        const gists = await res.json()
        if (!gists.length) break
        const match = gists.find(g => GIST_FILE in g.files)
        if (match) {
          gistId.value = match.id
          _persist()
          return
        }
        if (gists.length < 100) break
        page++
      }
    } catch {
      // non-critical — user can still push and it'll create a fresh gist
    }
  }

  // ─── Gist Push / Pull ──────────────────────────────────────────────────────

  async function push(payload) {
    if (!token.value) { error.value = 'Not connected to GitHub'; return false }
    syncing.value = true
    error.value   = null
    try {
      const body = {
        description: 'NicZero sync data',
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify(payload, null, 2) } },
      }
      let res
      if (gistId.value) {
        res = await fetch(`https://api.github.com/gists/${gistId.value}`, {
          method:  'PATCH',
          headers: _headers(),
          body:    JSON.stringify(body),
        })
      } else {
        res = await fetch('https://api.github.com/gists', {
          method:  'POST',
          headers: _headers(),
          body:    JSON.stringify(body),
        })
      }
      if (res.status === 401) throw new Error('Token expired — reconnect to GitHub')
      if (!res.ok)            throw new Error(`GitHub error ${res.status}`)
      const data = await res.json()
      gistId.value     = data.id
      lastSynced.value = new Date().toISOString()
      _persist()
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      syncing.value = false
    }
  }

  async function pull() {
    if (!token.value)  { error.value = 'Not connected to GitHub'; return null }
    if (!gistId.value) { error.value = 'No gist linked yet — push first'; return null }
    syncing.value = true
    error.value   = null
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId.value}`, {
        headers: _headers(),
      })
      if (res.status === 401) throw new Error('Token expired — reconnect to GitHub')
      if (res.status === 404) throw new Error('Gist not found — it may have been deleted')
      if (!res.ok)            throw new Error(`GitHub error ${res.status}`)
      const data    = await res.json()
      const content = data.files[GIST_FILE]?.content
      if (!content) throw new Error(`No ${GIST_FILE} found in gist`)
      const parsed = JSON.parse(content)
      if (!parsed.version || !Array.isArray(parsed.log)) throw new Error('Unrecognised data format')
      lastSynced.value = new Date().toISOString()
      _persist()
      return parsed
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      syncing.value = false
    }
  }

  return {
    token, gistId, lastSynced, syncing, error,
    oauthStep,
    isConfigured, hasSynced,
    load, setToken, clearToken,
    startOAuth, cancelOAuth,
    push, pull,
  }
})
