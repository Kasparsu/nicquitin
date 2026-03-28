import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useLogStore } from './log.js'
import { useTimeStore } from './time.js'
import { BEAT_STEP, INITIAL_MULTIPLIER, applyBeatResult, computeRecentSuccessRate } from '../lib/beat.js'
import { formatDuration } from '../lib/format.js'

const PROGRESS_KEY = 'nicquitin-progress'

const HABIT_MILESTONE_DEFS = [
  { id: 'heavy',      label: 'Heavy use',     maxUsesDay: 15,   minIntervalH: 1.6,  usesPerDayLabel: '>15'   },
  { id: 'regular',    label: 'Regular',       maxUsesDay: 10,   minIntervalH: 2.4,  usesPerDayLabel: '~10'   },
  { id: 'moderate',   label: 'Moderate',      maxUsesDay: 5,    minIntervalH: 4.8,  usesPerDayLabel: '~5'    },
  { id: 'light',      label: 'Light use',     maxUsesDay: 3,    minIntervalH: 8,    usesPerDayLabel: '~3'    },
  { id: 'occasional', label: 'Occasional',    maxUsesDay: 1,    minIntervalH: 24,   usesPerDayLabel: '<1'    },
  { id: 'rare',       label: 'Very rare',     maxUsesDay: 0.33, minIntervalH: 72,   usesPerDayLabel: '<1/3d' },
  { id: 'free',       label: 'Habit free 🏆', maxUsesDay: 0,    minIntervalH: 168,  usesPerDayLabel: '~0'    },
]

export { HABIT_MILESTONE_DEFS, BEAT_STEP }

export const useProgressStore = defineStore('progress', () => {
  const logStore = useLogStore()
  const time     = useTimeStore()

  const progressState = ref({
    multiplier:     INITIAL_MULTIPLIER,
    totalBeats:     0,
    totalAttempts:  0,
    currentStreak:  0,
    bestStreak:     0,
    bestIntervalMs: 0,
    recentOutcomes: [],
  })

  const level             = computed(() => progressState.value.totalBeats + 1)
  const recentOutcomes    = computed(() => progressState.value.recentOutcomes || [])
  const recentSuccessRate = computed(() => computeRecentSuccessRate(recentOutcomes.value))

  const recentDifficulty = computed(() => {
    const rate = recentSuccessRate.value
    if (rate === null) return null
    if (rate >= 0.7) return { label: 'dialed in', color: 'text-success' }
    if (rate >= 0.4) return { label: 'on track',  color: 'text-warning' }
    return                  { label: 'easing up', color: 'text-info'    }
  })

  const targetIntervalMs = computed(() =>
    logStore.avgIntervalMs > 0 ? logStore.avgIntervalMs * progressState.value.multiplier : 0
  )

  const timeSinceLastMs = computed(() =>
    logStore.lastUsed ? time.now - (logStore.lastUsed.stoppedTs || logStore.lastUsed.ts) : 0
  )

  const beatProgress    = computed(() =>
    targetIntervalMs.value > 0 ? timeSinceLastMs.value / targetIntervalMs.value : 0
  )
  const hasBeatenTarget = computed(() => beatProgress.value >= 1)

  const timeToTarget = computed(() => {
    const remaining = targetIntervalMs.value - timeSinceLastMs.value
    return remaining > 0 ? formatDuration(remaining) : null
  })

  const beatTimerColor = computed(() => {
    if (!logStore.hasEnoughData) {
      const s = timeSinceLastMs.value / 1000
      if (s < 1800) return 'text-error'
      if (s < 7200) return 'text-warning'
      return 'text-success'
    }
    if (hasBeatenTarget.value) return 'text-success'
    if (beatProgress.value > 0.75) return 'text-warning'
    return 'text-error'
  })

  const habitTimeline = computed(() => {
    const avgH        = logStore.avgIntervalMs / 3_600_000
    const usesPerD    = logStore.usesPerDay7d || 1
    const beatsPerDay = usesPerD * (recentSuccessRate.value ?? 0.35)

    return HABIT_MILESTONE_DEFS.map((m, i) => {
      const achieved  = avgH >= m.minIntervalH
      const isCurrent = !achieved && avgH >= (HABIT_MILESTONE_DEFS[i - 1]?.minIntervalH ?? 0)

      const currentTargetH = avgH * progressState.value.multiplier
      let beatsNeeded = 0
      if (!achieved && currentTargetH < m.minIntervalH) {
        beatsNeeded = Math.ceil(Math.log(m.minIntervalH / currentTargetH) / Math.log(1 + BEAT_STEP))
      }

      const daysNeeded = beatsNeeded > 0 && beatsPerDay > 0 ? beatsNeeded / beatsPerDay : 0
      let etaLabel = ''
      if (!achieved && daysNeeded > 0) {
        etaLabel = daysNeeded < 7
          ? `~${Math.round(daysNeeded)}d`
          : daysNeeded < 60
          ? `~${Math.round(daysNeeded / 7)}w`
          : `~${Math.round(daysNeeded / 30)}mo`
      }

      const h = m.minIntervalH
      const intervalLabel = h < 1
        ? `${Math.round(h * 60)}m`
        : h < 24
        ? `${h}h`
        : h < 168
        ? `${Math.round(h / 24)}d`
        : `${Math.round(h / 168)}w`

      return { ...m, achieved, isCurrent, beatsNeeded, daysNeeded, etaLabel, intervalLabel }
    })
  })

  function checkBeat(intervalMs) {
    if (logStore.avgIntervalMs === 0) return
    progressState.value = applyBeatResult(intervalMs, logStore.avgIntervalMs, progressState.value)
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState.value))
  }

  function load() {
    const saved = localStorage.getItem(PROGRESS_KEY)
    if (saved) progressState.value = { ...progressState.value, ...JSON.parse(saved) }
  }

  function importProgress(data) {
    progressState.value = { ...progressState.value, ...data }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState.value))
  }

  return {
    progressState, level, recentOutcomes, recentSuccessRate, recentDifficulty,
    targetIntervalMs, timeSinceLastMs, beatProgress, hasBeatenTarget, timeToTarget,
    beatTimerColor, habitTimeline,
    checkBeat, load, importProgress,
  }
})
