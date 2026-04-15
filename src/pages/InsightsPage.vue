<template>
  <div class="space-y-4">

    <!-- Sub-tabs -->
    <div class="flex gap-1 bg-base-300 rounded-xl p-1">
      <button
        v-for="t in tabs" :key="t.id"
        class="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors"
        :class="tab === t.id
          ? 'bg-base-100 text-base-content shadow-sm'
          : 'text-base-content/50 hover:text-base-content/80'"
        @click="tab = t.id"
      >{{ t.label }}</button>
    </div>

    <!-- Patterns tab -->
    <template v-if="tab === 'patterns'">
      <PatternsCard />
      <HabitTimelineCard />
    </template>

    <!-- Cravings tab -->
    <template v-if="tab === 'cravings'">

      <!-- Craving statistics -->
      <div v-if="totalCravings > 0" class="card bg-base-100 shadow">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">cravings</h2>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-lg font-bold font-mono">{{ totalCravings }}</div>
              <div class="text-[10px] text-base-content/50">total cravings</div>
            </div>
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-lg font-bold font-mono" :class="resistRate >= 0.5 ? 'text-success' : resistRate >= 0.25 ? 'text-warning' : 'text-error'">
                {{ Math.round(resistRate * 100) }}%
              </div>
              <div class="text-[10px] text-base-content/50">resisted</div>
            </div>
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-lg font-bold font-mono">{{ cravingsPerDay7d.toFixed(1) }}</div>
              <div class="text-[10px] text-base-content/50">per day (7d)</div>
            </div>
          </div>
          <div class="flex justify-between items-center text-xs text-base-content/40">
            <span>avg interval: <span class="font-mono font-medium text-base-content/60">{{ formatCravingInterval }}</span></span>
            <span v-if="resistRate7d > 0">7d resist: <span class="font-mono font-medium" :class="resistRate7d >= 0.5 ? 'text-success' : 'text-warning'">{{ Math.round(resistRate7d * 100) }}%</span></span>
          </div>
          <div>
            <div class="flex justify-between text-[10px] text-base-content/40 mb-0.5">
              <span>gave in</span>
              <span>resisted</span>
            </div>
            <progress class="progress w-full h-2" :class="resistRate >= 0.5 ? 'progress-success' : 'progress-warning'" :value="resistRate" max="1"></progress>
          </div>
        </div>
      </div>
      <div v-else class="text-center text-base-content/40 text-sm py-4">no craving data yet</div>

      <!-- Challenges summary -->
      <div v-if="totalCompleted > 0" class="card bg-base-100 shadow">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">challenges</h2>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-lg font-bold font-mono">{{ totalCompleted }}</div>
              <div class="text-[10px] text-base-content/50">completed</div>
            </div>
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-lg font-bold font-mono">{{ todayCount }}</div>
              <div class="text-[10px] text-base-content/50">today</div>
            </div>
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-lg font-bold font-mono">{{ streak }}d</div>
              <div class="text-[10px] text-base-content/50">streak</div>
            </div>
          </div>

          <div class="flex gap-2 flex-wrap">
            <div v-for="cat in categoryStats" :key="cat.id" class="badge badge-ghost gap-1 text-xs">
              {{ cat.emoji }} {{ cat.count }}
            </div>
          </div>

          <div v-if="recentChallenges.length" class="space-y-1">
            <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide">recent</div>
            <div v-for="c in recentChallenges" :key="c.ts" class="flex items-center gap-2 text-xs">
              <span>{{ catEmoji(c.category) }}</span>
              <span class="flex-1 truncate">{{ c.text }}</span>
              <span class="text-base-content/30 shrink-0">{{ formatRelative(c.ts) }}</span>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- Charts tab -->
    <template v-if="tab === 'charts'">
      <InsightsCharts />
    </template>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChallengesStore } from '../stores/challenges.js'
import { CATEGORIES } from '../lib/suggestions.js'
import { formatDuration } from '../lib/format.js'
import PatternsCard      from '../components/PatternsCard.vue'
import InsightsCharts    from '../components/InsightsCharts.vue'
import HabitTimelineCard from '../components/HabitTimelineCard.vue'

const tabs = [
  { id: 'patterns', label: 'Patterns' },
  { id: 'cravings', label: 'Cravings' },
  { id: 'charts',   label: 'Charts' },
]
const tab = ref('patterns')

const challengesStore = useChallengesStore()
const {
  totalCompleted, todayCount, streak,
  totalCravings, resistRate, resistRate7d, cravingsPerDay7d, avgCravingIntervalMs,
} = storeToRefs(challengesStore)

const recentChallenges = computed(() => challengesStore.log.slice(0, 5))

const categoryStats = computed(() => {
  const counts = {}
  for (const c of challengesStore.log) {
    counts[c.category] = (counts[c.category] || 0) + 1
  }
  return CATEGORIES.map(cat => ({ ...cat, count: counts[cat.id] || 0 })).filter(c => c.count > 0)
})

function catEmoji(catId) {
  return CATEGORIES.find(c => c.id === catId)?.emoji ?? '?'
}

const formatCravingInterval = computed(() => {
  if (!avgCravingIntervalMs.value) return '--'
  return formatDuration(avgCravingIntervalMs.value)
})

function formatRelative(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
</script>
