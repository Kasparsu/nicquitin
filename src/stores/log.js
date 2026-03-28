import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useTimeStore } from './time.js'
import { computeIntervals, computeAvgInterval, computeUsesPerDay7d, computeTrend } from '../lib/patterns.js'

const STORAGE_KEY = 'nicquitin-log'
const MIN_ENTRIES_FOR_PATTERNS = 5

export const useLogStore = defineStore('log', () => {
  const time = useTimeStore()

  const log = ref([])

  const lastUsed      = computed(() => log.value[0] ?? null)
  const hasEnoughData = computed(() => log.value.length >= MIN_ENTRIES_FOR_PATTERNS)
  const intervals     = computed(() => computeIntervals(log.value))
  const avgIntervalMs = computed(() => computeAvgInterval(intervals.value))
  const usesPerDay7d  = computed(() => computeUsesPerDay7d(log.value, time.now))
  const trend         = computed(() => computeTrend(intervals.value))

  const peakHours = computed(() => {
    if (!log.value.length) return []
    const counts = new Array(24).fill(0)
    log.value.forEach(e => counts[new Date(e.ts).getHours()]++)
    const blocks = []
    for (let h = 0; h < 24; h += 3) {
      const count = counts[h] + counts[h + 1] + counts[h + 2]
      if (!count) continue
      const start  = h === 0 ? 12 : h > 12 ? h - 12 : h
      const end    = (h + 3) > 12 ? (h + 3 - 12) : (h + 3)
      const endAmpm = (h + 3) < 12 ? 'am' : 'pm'
      blocks.push({ label: `${start}–${end}${endAmpm}`, count })
    }
    return blocks.sort((a, b) => b.count - a.count).slice(0, 2)
  })

  function load() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) log.value = JSON.parse(saved)
  }

  function addEntry(entry) {
    log.value.unshift(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
  }

  function removeEntry(id) {
    log.value = log.value.filter(e => e.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
  }

  function clearAll() {
    log.value = []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
  }

  function importLog(entries) {
    log.value = entries
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
  }

  return {
    log, lastUsed, hasEnoughData, intervals, avgIntervalMs, usesPerDay7d, trend, peakHours,
    load, addEntry, removeEntry, clearAll, importLog,
  }
})
