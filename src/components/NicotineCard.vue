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
      <div class="divider text-xs my-0">recovery milestones</div>
      <div v-if="lastUsed" class="space-y-2">
        <div v-for="m in milestones" :key="m.label" class="flex items-center gap-2 text-sm">
          <span class="shrink-0 w-5 text-center">{{ m.achieved ? '✅' : '🔘' }}</span>
          <span class="flex-1 leading-tight" :class="m.achieved ? 'text-success' : 'text-base-content/70'">{{ m.label }}</span>
          <span class="text-xs text-base-content/50 shrink-0">{{ m.achieved ? m.ago : 'in ' + m.remaining }}</span>
        </div>
      </div>
      <div v-else class="text-center text-base-content/40 text-sm py-2">log usage to see milestones</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { formatDuration, relativeAgo } from '../lib/format.js'
import { useTimeStore }    from '../stores/time.js'
import { useLogStore }     from '../stores/log.js'
import { useProfileStore } from '../stores/profile.js'
import { useNicotineStore, GAUGE_MAX, CLEAN_THRESHOLD } from '../stores/nicotine.js'

const MILESTONE_DEFS = [
  { label: '❤️  Heart rate & BP drop',        offsetMs: 20  * 60 * 1000 },
  { label: '💨  Carbon monoxide clears',       offsetMs: 12  * 60 * 60 * 1000, requiresCombustion: true },
  { label: '🧹  Nicotine-free (3 days)',       offsetMs: 3   * 24 * 60 * 60 * 1000 },
  { label: '🩸  Circulation improves (2 wks)', offsetMs: 14  * 24 * 60 * 60 * 1000 },
  { label: '🧠  Cravings greatly reduced',     offsetMs: 90  * 24 * 60 * 60 * 1000 },
  { label: '🏥  Heart disease risk halved',    offsetMs: 365 * 24 * 60 * 60 * 1000 },
]

const time    = useTimeStore()
const { log, lastUsed }          = storeToRefs(useLogStore())
const { halfLifeH }              = storeToRefs(useProfileStore())
const { nicotineLevel, gaugeColor, timeUntilClean } = storeToRefs(useNicotineStore())

// Last entry from a combustible product (cigarette, cigar, or any custom with producesCO)
const lastCombustibleUsed = computed(() =>
  log.value.find(e => e.producesCO === true || e.productId === 'cigarette' || e.productId === 'cigar') ?? null
)

const milestones = computed(() => {
  if (!lastUsed.value) return []
  const baseTs = lastUsed.value.stoppedTs || lastUsed.value.ts
  return MILESTONE_DEFS
    .filter(m => !m.requiresCombustion || lastCombustibleUsed.value !== null)
    .map(m => {
      const entryTs = m.requiresCombustion
        ? (lastCombustibleUsed.value.stoppedTs || lastCombustibleUsed.value.ts)
        : baseTs
      const ts       = entryTs + m.offsetMs
      const achieved = time.now >= ts
      return { label: m.label, ts, achieved, remaining: achieved ? null : formatDuration(ts - time.now), ago: achieved ? relativeAgo(ts, time.now) : null }
    })
})
</script>
