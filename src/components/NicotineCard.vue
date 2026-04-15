<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-3">
      <h2 class="card-title text-base">nicotine in body</h2>
      <div>
        <progress class="progress w-full h-3" :class="gaugeColor"
          :value="Math.min(nicotineLevel, GAUGE_MAX)" :max="GAUGE_MAX"></progress>
        <div class="flex justify-between mt-1 text-xs text-base-content/40">
          <span>0 mg</span><span>{{ GAUGE_MAX }} mg</span>
        </div>
      </div>
      <div class="flex items-end justify-between">
        <div>
          <span class="text-4xl font-mono font-bold tabular-nums">{{ nicotineLevel.toFixed(2) }}</span>
          <span class="text-sm text-base-content/50 ml-1">mg estimated</span>
        </div>
        <div class="text-right text-sm">
          <div v-if="nicotineLevel > CLEAN_THRESHOLD" class="text-base-content/60">
            clean in <span class="font-semibold">~{{ timeUntilClean }}</span>
          </div>
          <div v-else class="text-success font-semibold">nicotine free ✓</div>
          <div class="text-xs text-base-content/30 mt-0.5">t½ = {{ halfLifeH }}h</div>
        </div>
      </div>
      <div v-if="milestoneGroups.length" class="space-y-3">
        <template v-for="group in milestoneGroups" :key="group.title">
          <div class="divider text-xs my-0">{{ group.title }}</div>
          <div class="space-y-1.5">
            <div v-for="m in group.milestones" :key="m.label" class="flex items-center gap-2 text-sm">
              <span class="shrink-0 w-5 text-center">{{ m.achieved ? '✅' : '🔘' }}</span>
              <span class="flex-1 leading-tight" :class="m.achieved ? 'text-success' : 'text-base-content/70'">{{ m.label }}</span>
              <span class="text-xs text-base-content/50 shrink-0">{{ m.achieved ? m.ago : 'in ' + m.remaining }}</span>
            </div>
          </div>
        </template>
      </div>
      <div v-else class="text-center text-base-content/40 text-sm py-2">log usage to see milestones</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { formatDuration, relativeAgo } from '../lib/format.js'
import { useTimeStore }     from '../stores/time.js'
import { useLogStore }      from '../stores/log.js'
import { useProfileStore }  from '../stores/profile.js'
import { useSessionsStore } from '../stores/sessions.js'
import { useNicotineStore, GAUGE_MAX, CLEAN_THRESHOLD } from '../stores/nicotine.js'

// Phase 1: Quit smoking → vaping/pouches/NRT
const COMBUSTION_MILESTONES = [
  { label: '💨  Carbon monoxide clears',          offsetMs: 24  * 60 * 60 * 1000 },
  { label: '👃  Taste & smell improving',          offsetMs: 48  * 60 * 60 * 1000 },
  { label: '🫁  Lungs clearing, cilia recovering', offsetMs: 30  * 24 * 60 * 60 * 1000 },
  { label: '🫁  Lung function increase',           offsetMs: 90  * 24 * 60 * 60 * 1000 },
]

// Phase 2: Quit vaping/pouches → NRT only
const HABIT_MILESTONES = [
  { label: '🧠  Breaking spike/reward cycle',      offsetMs: 1   * 24 * 60 * 60 * 1000 },
  { label: '📊  Blood sugar stabilising',           offsetMs: 14  * 24 * 60 * 60 * 1000 },
  { label: '👄  Oral health improving',             offsetMs: 21  * 24 * 60 * 60 * 1000 },
  { label: '😌  No longer a "user"',                offsetMs: 30  * 24 * 60 * 60 * 1000 },
]

// Phase 3: Quit all nicotine
const NICOTINE_FREE_MILESTONES = [
  { label: '❤️  Heart rate & BP at natural levels', offsetMs: 20  * 60 * 1000 },
  { label: '🧹  Nicotine fully out of body',        offsetMs: 3   * 24 * 60 * 60 * 1000 },
  { label: '🧠  Brain fog lifts, natural dopamine',  offsetMs: 28  * 24 * 60 * 60 * 1000 },
  { label: '🩸  Circulation noticeably improved',    offsetMs: 90  * 24 * 60 * 60 * 1000 },
  { label: '😴  Deep sleep & baseline anxiety gone', offsetMs: 40  * 24 * 60 * 60 * 1000 },
  { label: '🏥  Heart disease risk halved',          offsetMs: 365 * 24 * 60 * 60 * 1000 },
]

const time    = useTimeStore()
const logStore = useLogStore()
const { log, lastUsed, lastHabitUsed } = storeToRefs(logStore)
const { halfLifeH }              = storeToRefs(useProfileStore())
const { nicotineLevel, gaugeColor, timeUntilClean } = storeToRefs(useNicotineStore())

const sessionsStore = useSessionsStore()
const { hasActiveSessions } = storeToRefs(sessionsStore)

// Last entry from a combustible product
const lastCombustibleTs = computed(() => {
  const e = log.value.find(e => e.producesCO === true || e.productId === 'cigarette' || e.productId === 'cigar')
  return e ? (e.stoppedTs || e.ts) : null
})

// Last entry from a non-NRT habit (vape, pouch, cigarette, etc.)
const lastHabitTs = computed(() => {
  if (!lastHabitUsed.value) return null
  return lastHabitUsed.value.stoppedTs || lastHabitUsed.value.ts
})

// Last usage of anything (including NRT + active sessions)
const lastAnyTs = computed(() => {
  if (hasActiveSessions.value) return time.now
  if (!lastUsed.value) return null
  return lastUsed.value.stoppedTs || lastUsed.value.ts
})

function buildMilestones(defs, baseTs) {
  if (baseTs === null) return []
  return defs.map(m => {
    const ts       = baseTs + m.offsetMs
    const achieved = time.now >= ts
    return { label: m.label, ts, achieved, remaining: achieved ? null : formatDuration(ts - time.now), ago: achieved ? relativeAgo(ts, time.now) : null }
  })
}

// Milestone groups — each section only shows if the user has relevant history
const milestoneGroups = computed(() => {
  const groups = []

  if (lastCombustibleTs.value !== null) {
    groups.push({
      title: 'quit smoking',
      milestones: buildMilestones(COMBUSTION_MILESTONES, lastCombustibleTs.value),
    })
  }

  if (lastHabitTs.value !== null) {
    groups.push({
      title: 'quit vaping / pouches',
      milestones: buildMilestones(HABIT_MILESTONES, lastHabitTs.value),
    })
  }

  if (lastAnyTs.value !== null) {
    groups.push({
      title: 'nicotine free',
      milestones: buildMilestones(NICOTINE_FREE_MILESTONES, lastAnyTs.value),
    })
  }

  return groups
})
</script>
