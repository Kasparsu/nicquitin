import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useLogStore } from './log.js'
import { useTimeStore } from './time.js'

const STORAGE_KEY = 'nicquitin-challenges'

export const useChallengesStore = defineStore('challenges', () => {
  const logStore = useLogStore()
  const time = useTimeStore()

  const log = ref([])

  const totalCompleted = computed(() => log.value.length)

  const todayCount = computed(() => {
    const today = new Date().toDateString()
    return log.value.filter(c => new Date(c.ts).toDateString() === today).length
  })

  // Current streak: consecutive days with at least one challenge
  const streak = computed(() => {
    if (!log.value.length) return 0
    const days = new Set(log.value.map(c => new Date(c.ts).toDateString()))
    let count = 0
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    while (days.has(d.toDateString())) {
      count++
      d.setDate(d.getDate() - 1)
    }
    return count
  })

  // ─── Craving stats ──────────────────────────────────────────────────────────
  // A "craving event" is either a habit log entry or a completed challenge.
  // Merging both gives us the true craving timeline.

  // All craving events sorted newest-first
  const cravingEvents = computed(() => {
    const habits = logStore.habitLog.map(e => ({ ts: e.stoppedTs || e.ts, type: 'used' }))
    const resisted = log.value.map(c => ({ ts: c.ts, type: 'resisted' }))
    return [...habits, ...resisted].sort((a, b) => b.ts - a.ts)
  })

  const totalCravings = computed(() => cravingEvents.value.length)

  const resistRate = computed(() => {
    if (!totalCravings.value) return 0
    return totalCompleted.value / totalCravings.value
  })

  // Average interval between craving events (more accurate than habit-only)
  const avgCravingIntervalMs = computed(() => {
    const events = cravingEvents.value
    if (events.length < 2) return 0
    let sum = 0, count = 0
    for (let i = 0; i < events.length - 1; i++) {
      const gap = events[i].ts - events[i + 1].ts
      if (gap > 0) { sum += gap; count++ }
    }
    return count > 0 ? sum / count : 0
  })

  // Predicted next craving based on last craving event + avg interval
  const lastCravingTs = computed(() => cravingEvents.value[0]?.ts ?? null)

  const predictedNextCravingTs = computed(() => {
    if (!lastCravingTs.value || !avgCravingIntervalMs.value) return null
    return lastCravingTs.value + avgCravingIntervalMs.value
  })

  // Cravings per day (last 7 days)
  const cravingsPerDay7d = computed(() => {
    const cutoff = time.now - 7 * 86_400_000
    const recent = cravingEvents.value.filter(e => e.ts >= cutoff)
    return recent.length / 7
  })

  // Resist rate for last 7 days
  const resistRate7d = computed(() => {
    const cutoff = time.now - 7 * 86_400_000
    const recentAll = cravingEvents.value.filter(e => e.ts >= cutoff)
    const recentResisted = recentAll.filter(e => e.type === 'resisted')
    return recentAll.length > 0 ? recentResisted.length / recentAll.length : 0
  })

  function complete(suggestion, wasNRT) {
    log.value.unshift({
      ts: Date.now(),
      id: suggestion.id,
      text: suggestion.text,
      category: suggestion.cat,
      wasNRT,
    })
    _persist()
  }

  function _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
  }

  function load() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) log.value = JSON.parse(saved)
  }

  return {
    log, totalCompleted, todayCount, streak,
    cravingEvents, totalCravings, resistRate, avgCravingIntervalMs,
    lastCravingTs, predictedNextCravingTs, cravingsPerDay7d, resistRate7d,
    complete, load,
  }
})
