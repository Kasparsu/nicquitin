import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useTimeStore }     from './time.js'
import { useProductsStore } from './products.js'
import { useLogStore }      from './log.js'
import { useProgressStore } from './progress.js'
import { computeSessionProgress, computeSessionRemainingMs, computeSessionEstimatedDose, computeStopSessionDose } from '../lib/session.js'
import { formatDuration } from '../lib/format.js'

// Unified session key — old separate keys migrated on load
const SESSIONS_KEY = 'nicquitin-sessions-v2'

export const useSessionsStore = defineStore('sessions', () => {
  const time     = useTimeStore()
  const products = useProductsStore()
  const log      = useLogStore()
  const progress = useProgressStore()

  // All slow-release sessions in one array.
  // Shape: { id, productId, startTs, reuseCount, activeMs, paused, lastResumeTs }
  // For non-pauseable products: paused is always false, lastResumeTs === startTs.
  const sessions = ref([])

  const hasActiveSessions = computed(() => sessions.value.length > 0)

  // Active ms for a session (pause-aware)
  function sessionActiveMs(s, nowMs) {
    return s.activeMs + (s.paused ? 0 : (nowMs - s.lastResumeTs))
  }

  // Virtual entries for nicotine computation of in-progress sessions
  const activeSessionEntries = computed(() => {
    return sessions.value
      .filter(s => !s.paused)
      .flatMap(s => {
        const p = products.productById(s.productId)
        if (!p) return []
        const effectiveStart = time.now - sessionActiveMs(s, time.now)
        return [{ ts: effectiveStart, nicotineMg: p.nicotineMg * Math.pow(0.5, s.reuseCount || 0), releaseType: p.releaseType, releaseDurationH: p.releaseDurationH }]
      })
  })

  // Backwards-compat aliases consumed by LogUsageCard
  const activeSessions = computed(() => sessions.value)
  const pouchSessions  = computed(() => sessions.value.filter(s => s.productId === 'pouch'))

  function startSession(productId, startTs) {
    const ts = startTs ?? Date.now()
    sessions.value = [...sessions.value, {
      id: ts, productId, startTs: ts, reuseCount: 0,
      activeMs: 0, paused: false, lastResumeTs: ts,
    }]
    _persist()
  }

  function stopSession(sessionId, opts = {}) {
    const s = sessions.value.find(x => x.id === sessionId)
    if (!s) return
    const p = products.productById(s.productId)
    if (!p) return

    const stopTs          = Date.now()
    const activeMs        = sessionActiveMs(s, stopTs)
    const actualDurationH = activeMs / 3_600_000
    const maxDurationH    = p.releaseDurationH || 1
    const scaledMg        = computeStopSessionDose(_eff(s, stopTs), p, stopTs, opts)

    const prevEntry = log.log[0]
    log.addEntry({
      id: s.startTs, productId: p.id, product: p.name, emoji: p.emoji,
      nicotineMg: scaledMg,
      releaseType: p.releaseType,
      releaseDurationH: Math.min(actualDurationH, maxDurationH),
      puffs: null,
      ts: s.startTs, stoppedTs: stopTs,
      reuseCount: s.reuseCount || 0,
    })

    if (prevEntry && log.hasEnoughData) {
      const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
      const interval = s.startTs - prevEnd
      if (interval >= 5 * 60_000) progress.checkBeat(interval)
    }

    sessions.value = sessions.value.filter(x => x.id !== sessionId)
    _persist()
  }

  function pauseSession(sessionId) {
    const nowMs = Date.now()
    sessions.value = sessions.value.map(s =>
      s.id === sessionId
        ? { ...s, paused: true, activeMs: s.activeMs + (nowMs - s.lastResumeTs) }
        : s
    )
    _persist()
  }

  function resumeSession(sessionId) {
    const nowMs = Date.now()
    sessions.value = sessions.value.map(s =>
      s.id === sessionId
        ? { ...s, paused: false, reuseCount: s.reuseCount + 1, lastResumeTs: nowMs }
        : s
    )
    _persist()
  }

  // ─── Display helpers (take session object) ─────────────────────────────────

  // Returns a synthetic session with startTs adjusted for paused time,
  // so the lib functions (which use startTs) work correctly.
  function _eff(s, nowMs) {
    return { startTs: nowMs - sessionActiveMs(s, nowMs), reuseCount: s.reuseCount }
  }

  function sessionElapsed(s) {
    if (!s) return ''
    const ms  = sessionActiveMs(s, time.now)
    const sec = Math.floor(ms / 1000)
    const h   = Math.floor(sec / 3600)
    const m   = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    return `${m}m ${String(sec % 60).padStart(2, '0')}s`
  }

  function sessionElapsedShort(s) {
    if (!s) return ''
    const ms  = sessionActiveMs(s, time.now)
    const sec = Math.floor(ms / 1000)
    const h   = Math.floor(sec / 3600)
    const m   = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
    return `${m}m`
  }

  function sessionProgress(s) {
    const p = products.productById(s.productId)
    if (!s || !p) return 0
    return computeSessionProgress(_eff(s, time.now), p, time.now)
  }

  function sessionTimeRemaining(s) {
    const p = products.productById(s.productId)
    if (!s || !p) return ''
    const ms = computeSessionRemainingMs(_eff(s, time.now), p, time.now)
    return ms > 0 ? formatDuration(ms) : null
  }

  function sessionEstimatedDose(s) {
    const p = products.productById(s.productId)
    if (!s || !p) return '0'
    return computeSessionEstimatedDose(_eff(s, time.now), p, time.now).toFixed(2)
  }

  function _persist() {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.value))
  }

  function load() {
    // Try new unified format first
    const saved = localStorage.getItem(SESSIONS_KEY)
    if (saved) {
      sessions.value = JSON.parse(saved)
      return
    }

    // Migrate old activeSessions object + pouchSessions array
    const oldSessions = localStorage.getItem('nicquitin-sessions')
    const oldPouch    = localStorage.getItem('nicquitin-pouch-sessions')
    const migrated    = []

    if (oldSessions) {
      const parsed = JSON.parse(oldSessions)
      for (const [productId, s] of Object.entries(parsed)) {
        migrated.push({ id: s.startTs, productId, startTs: s.startTs, reuseCount: s.reuseCount || 0, activeMs: 0, paused: false, lastResumeTs: s.startTs })
      }
    }
    if (oldPouch) {
      for (const s of JSON.parse(oldPouch)) {
        migrated.push({ id: s.id, productId: 'pouch', startTs: s.startTs, reuseCount: s.reuseCount || 0, activeMs: s.activeMs || 0, paused: s.paused || false, lastResumeTs: s.lastResumeTs || s.startTs })
      }
    }

    if (migrated.length) {
      sessions.value = migrated
      _persist()
    }
  }

  function importSessions(data) {
    // Accept both old object format and new array format
    if (Array.isArray(data)) {
      sessions.value = data
    } else {
      sessions.value = Object.entries(data).map(([productId, s]) => ({
        id: s.startTs, productId, startTs: s.startTs, reuseCount: s.reuseCount || 0,
        activeMs: 0, paused: false, lastResumeTs: s.startTs,
      }))
    }
    _persist()
  }

  function importPouchSessions(data) {
    // Merge pouch sessions into unified array, replacing existing pouch entries
    sessions.value = [
      ...sessions.value.filter(s => s.productId !== 'pouch'),
      ...data.map(s => ({
        id: s.id, productId: 'pouch', startTs: s.startTs,
        reuseCount: s.reuseCount || 0, activeMs: s.activeMs || 0,
        paused: s.paused || false, lastResumeTs: s.lastResumeTs || s.startTs,
      })),
    ]
    _persist()
  }

  return {
    sessions, hasActiveSessions, activeSessionEntries,
    // compat aliases used by LogUsageCard
    activeSessions, pouchSessions,
    startSession,
    stopSession, pauseSession, resumeSession,
    sessionElapsed, sessionElapsedShort, sessionProgress, sessionTimeRemaining, sessionEstimatedDose,
    load, importSessions, importPouchSessions,
  }
})
