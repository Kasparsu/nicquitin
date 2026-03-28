import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useTimeStore }     from './time.js'
import { useProductsStore } from './products.js'
import { useLogStore }      from './log.js'
import { useProgressStore } from './progress.js'
import { computeSessionProgress, computeSessionRemainingMs, computeSessionEstimatedDose, computeStopSessionDose } from '../lib/session.js'
import { formatDuration } from '../lib/format.js'

const SESSIONS_KEY       = 'nicquitin-sessions'
const POUCH_SESSIONS_KEY = 'nicquitin-pouch-sessions'

export const useSessionsStore = defineStore('sessions', () => {
  const time     = useTimeStore()
  const products = useProductsStore()
  const log      = useLogStore()
  const progress = useProgressStore()

  const activeSessions = ref({})   // { [productId]: { startTs, reuseCount } }
  const pouchSessions  = ref([])   // [{ id, startTs, reuseCount, activeMs, paused, lastResumeTs }]

  const hasActiveSessions = computed(() =>
    Object.keys(activeSessions.value).length > 0 || pouchSessions.value.length > 0
  )

  // Active ms for a pouch session, excluding paused time
  function pouchActiveMs(s, nowMs) {
    return s.activeMs + (s.paused ? 0 : (nowMs - s.lastResumeTs))
  }

  // Virtual entries for nicotine computation of in-progress sessions
  const activeSessionEntries = computed(() => {
    const fromSessions = Object.entries(activeSessions.value).flatMap(([productId, session]) => {
      const p = products.productById(productId)
      if (!p) return []
      return [{ ts: session.startTs, nicotineMg: p.nicotineMg * Math.pow(0.5, session.reuseCount || 0), releaseType: p.releaseType, releaseDurationH: p.releaseDurationH }]
    })
    const pouch = products.productById('pouch')
    const fromPouch = pouch ? pouchSessions.value
      .filter(s => !s.paused)
      .map(s => {
        const effectiveStart = time.now - pouchActiveMs(s, time.now)
        return { ts: effectiveStart, nicotineMg: pouch.nicotineMg * Math.pow(0.5, s.reuseCount), releaseType: pouch.releaseType, releaseDurationH: pouch.releaseDurationH }
      }) : []
    return [...fromSessions, ...fromPouch]
  })

  function startSession(productId) {
    activeSessions.value = { ...activeSessions.value, [productId]: { startTs: Date.now(), reuseCount: 0 } }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions.value))
  }

  function stopSession(productId, opts = {}) {
    const session = activeSessions.value[productId]
    if (!session) return
    const p = products.productById(productId)
    if (!p) return

    const stopTs          = Date.now()
    const actualDurationH = (stopTs - session.startTs) / 3_600_000
    const maxDurationH    = p.releaseDurationH || 1
    const scaledMg        = computeStopSessionDose(session, p, stopTs, opts)

    const prevEntry = log.log[0]
    log.addEntry({
      id: session.startTs, productId: p.id, product: p.name, emoji: p.emoji,
      nicotineMg: scaledMg,
      releaseType: p.releaseType,
      releaseDurationH: Math.min(actualDurationH, maxDurationH),
      puffs: null,
      ts: session.startTs, stoppedTs: stopTs,
      reuseCount: session.reuseCount || 0,
    })

    if (prevEntry && log.hasEnoughData) {
      const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
      const interval = session.startTs - prevEnd
      if (interval >= 5 * 60_000) progress.checkBeat(interval)
    }

    const updated = { ...activeSessions.value }
    delete updated[productId]
    activeSessions.value = updated
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions.value))
  }

  function startPouchSession() {
    const nowMs = Date.now()
    pouchSessions.value = [...pouchSessions.value, { id: nowMs, startTs: nowMs, reuseCount: 0, activeMs: 0, paused: false, lastResumeTs: nowMs }]
    localStorage.setItem(POUCH_SESSIONS_KEY, JSON.stringify(pouchSessions.value))
  }

  function pausePouch(id) {
    const nowMs = Date.now()
    pouchSessions.value = pouchSessions.value.map(s =>
      s.id === id ? { ...s, paused: true, activeMs: s.activeMs + (nowMs - s.lastResumeTs) } : s
    )
    localStorage.setItem(POUCH_SESSIONS_KEY, JSON.stringify(pouchSessions.value))
  }

  function resumePouch(id) {
    const nowMs = Date.now()
    pouchSessions.value = pouchSessions.value.map(s =>
      s.id === id ? { ...s, paused: false, reuseCount: s.reuseCount + 1, lastResumeTs: nowMs } : s
    )
    localStorage.setItem(POUCH_SESSIONS_KEY, JSON.stringify(pouchSessions.value))
  }

  function removePouchDone(id) {
    const s = pouchSessions.value.find(x => x.id === id)
    if (!s) return
    const p = products.productById('pouch')
    if (!p) return

    const nowMs      = Date.now()
    const activeMs   = pouchActiveMs(s, nowMs)
    const activeDurH = activeMs / 3_600_000
    const maxDurH    = p.releaseDurationH || 1
    const scaledMg   = p.nicotineMg * Math.min(1, activeDurH / maxDurH) * Math.pow(0.5, s.reuseCount)

    const prevEntry = log.log[0]
    log.addEntry({
      id: s.id, productId: p.id, product: p.name, emoji: p.emoji,
      nicotineMg: scaledMg, releaseType: p.releaseType,
      releaseDurationH: Math.min(activeDurH, maxDurH),
      puffs: null, ts: s.startTs, stoppedTs: nowMs,
      reuseCount: s.reuseCount,
    })

    if (prevEntry && log.hasEnoughData) {
      const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
      const interval = s.startTs - prevEnd
      if (interval >= 5 * 60_000) progress.checkBeat(interval)
    }

    pouchSessions.value = pouchSessions.value.filter(x => x.id !== id)
    localStorage.setItem(POUCH_SESSIONS_KEY, JSON.stringify(pouchSessions.value))
  }

  // ─── Display helpers ────────────────────────────────────────────────────────

  function sessionElapsed(productId) {
    const session = activeSessions.value[productId]
    if (!session) return ''
    const s = Math.floor((time.now - session.startTs) / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    return `${m}m ${String(s % 60).padStart(2, '0')}s`
  }

  function sessionElapsedShort(productId) {
    const session = activeSessions.value[productId]
    if (!session) return ''
    const s = Math.floor((time.now - session.startTs) / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
    return `${m}m`
  }

  function sessionProgress(productId) {
    const session = activeSessions.value[productId]
    const p = products.productById(productId)
    if (!session || !p) return 0
    return computeSessionProgress(session, p, time.now)
  }

  function sessionTimeRemaining(productId) {
    const session = activeSessions.value[productId]
    const p = products.productById(productId)
    if (!session || !p) return ''
    const ms = computeSessionRemainingMs(session, p, time.now)
    return ms > 0 ? formatDuration(ms) : null
  }

  function sessionEstimatedDose(productId) {
    const session = activeSessions.value[productId]
    const p = products.productById(productId)
    if (!session || !p) return '0'
    return computeSessionEstimatedDose(session, p, time.now).toFixed(2)
  }

  function pouchProgressVal(s) {
    const p = products.productById('pouch')
    if (!p || !p.releaseDurationH) return 0
    return pouchActiveMs(s, time.now) / (p.releaseDurationH * 3_600_000)
  }

  function pouchElapsedDisplay(s) {
    const ms  = pouchActiveMs(s, time.now)
    const sec = Math.floor(ms / 1000)
    const h   = Math.floor(sec / 3600)
    const m   = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
    return `${m}m ${String(sec % 60).padStart(2, '0')}s`
  }

  function pouchTimeRemainingDisplay(s) {
    const p = products.productById('pouch')
    if (!p || !p.releaseDurationH) return ''
    const remainMs = Math.max(0, p.releaseDurationH * 3_600_000 - pouchActiveMs(s, time.now))
    return remainMs > 0 ? formatDuration(remainMs) + ' remaining' : '✓ fully absorbed'
  }

  function pouchEstimatedDoseDisplay(s) {
    const p = products.productById('pouch')
    if (!p) return '0'
    const activeDurH = pouchActiveMs(s, time.now) / 3_600_000
    const maxDurH    = p.releaseDurationH || 1
    return (p.nicotineMg * Math.min(1, activeDurH / maxDurH) * Math.pow(0.5, s.reuseCount)).toFixed(2)
  }

  function load() {
    const savedSessions = localStorage.getItem(SESSIONS_KEY)
    if (savedSessions) activeSessions.value = JSON.parse(savedSessions)
    const savedPouch = localStorage.getItem(POUCH_SESSIONS_KEY)
    if (savedPouch) pouchSessions.value = JSON.parse(savedPouch)
  }

  function importSessions(data) {
    activeSessions.value = data
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions.value))
  }

  function importPouchSessions(data) {
    pouchSessions.value = data
    localStorage.setItem(POUCH_SESSIONS_KEY, JSON.stringify(pouchSessions.value))
  }

  return {
    activeSessions, pouchSessions, hasActiveSessions, activeSessionEntries,
    startSession, stopSession,
    startPouchSession, pausePouch, resumePouch, removePouchDone,
    sessionElapsed, sessionElapsedShort, sessionProgress, sessionTimeRemaining, sessionEstimatedDose,
    pouchProgressVal, pouchElapsedDisplay, pouchTimeRemainingDisplay, pouchEstimatedDoseDisplay,
    load, importSessions, importPouchSessions,
  }
})
