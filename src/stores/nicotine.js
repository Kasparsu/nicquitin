import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLogStore }      from './log.js'
import { useSessionsStore } from './sessions.js'
import { useProfileStore }  from './profile.js'
import { useTimeStore }     from './time.js'
import { CLEAN_THRESHOLD, nicotineFromEntry, computeTimeUntilCleanMs } from '../lib/pharmacokinetics.js'
import { formatDuration } from '../lib/format.js'

export const GAUGE_MAX = 15

export { CLEAN_THRESHOLD }

export const useNicotineStore = defineStore('nicotine', () => {
  const log      = useLogStore()
  const sessions = useSessionsStore()
  const profile  = useProfileStore()
  const time     = useTimeStore()

  const nicotineLevel = computed(() => {
    const hl         = profile.halfLifeH
    const fromLog    = log.log.reduce((s, e) => s + nicotineFromEntry(e, time.now, hl), 0)
    const fromActive = sessions.activeSessionEntries.reduce((s, e) => s + nicotineFromEntry(e, time.now, hl), 0)
    return Math.max(0, fromLog + fromActive)
  })

  const gaugeColor = computed(() => {
    const r = nicotineLevel.value / GAUGE_MAX
    if (r < 0.25) return 'progress-success'
    if (r < 0.6)  return 'progress-warning'
    return 'progress-error'
  })

  const timeUntilClean = computed(() => {
    const entries = [...log.log, ...sessions.activeSessionEntries]
    const ms = computeTimeUntilCleanMs(entries, time.now, profile.halfLifeH)
    return ms != null ? formatDuration(ms) : null
  })

  return { nicotineLevel, gaugeColor, timeUntilClean }
})
