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
          <span class="text-sm text-base-content/50 ml-1">mg</span>
          <span class="text-xs font-mono ml-2" :class="nicotineRatePerH >= 0 ? 'text-error/60' : 'text-success/60'">
            {{ nicotineRatePerH >= 0 ? '+' : '' }}{{ nicotineRatePerH.toFixed(2) }} mg/h
          </span>
        </div>
        <div class="text-right text-sm">
          <div v-if="nicotineLevel > CLEAN_THRESHOLD" class="text-base-content/60">
            clean in <span class="font-semibold">~{{ timeUntilClean }}</span>
          </div>
          <div v-else class="text-success font-semibold">nicotine free ✓</div>
          <div class="text-xs text-base-content/30 mt-0.5">t½ = {{ halfLifeH }}h</div>
        </div>
      </div>
      <div class="h-28 -mx-2">
        <Line :data="chartData" :options="chartOptions" />
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
import { Line } from 'vue-chartjs'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { formatDuration, relativeAgo } from '../lib/format.js'
import { nicotineFromEntry } from '../lib/pharmacokinetics.js'
import { useTimeStore }     from '../stores/time.js'
import { useLogStore }      from '../stores/log.js'
import { useProfileStore }  from '../stores/profile.js'
import { useSessionsStore } from '../stores/sessions.js'
import { useNicotineStore, GAUGE_MAX, CLEAN_THRESHOLD } from '../stores/nicotine.js'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

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
const profileStore = useProfileStore()
const { halfLifeH }              = storeToRefs(profileStore)
const { nicotineLevel, nicotineRatePerH, gaugeColor, timeUntilClean } = storeToRefs(useNicotineStore())

const sessionsStore = useSessionsStore()
const { hasActiveSessions } = storeToRefs(sessionsStore)

// 24-hour nicotine level chart — stacked by category with usage markers
const SAMPLES = 96
const STEP_MS = 15 * 60_000

// Category colors keyed by emoji (stable across products)
const CAT_COLORS = {
  '🚬': { border: 'rgba(239,68,68,0.8)',  bg: 'rgba(239,68,68,0.18)',  label: 'Cigarette' },
  '🍂': { border: 'rgba(180,83,9,0.8)',   bg: 'rgba(180,83,9,0.15)',   label: 'Cigar' },
  '💨': { border: 'rgba(99,182,255,0.8)', bg: 'rgba(99,182,255,0.15)', label: 'E-cigarette' },
  '🫙': { border: 'rgba(168,85,247,0.8)', bg: 'rgba(168,85,247,0.15)', label: 'Pouch' },
  '🔥': { border: 'rgba(249,115,22,0.8)', bg: 'rgba(249,115,22,0.15)', label: 'Heated' },
  '🍃': { border: 'rgba(34,197,94,0.7)',  bg: 'rgba(34,197,94,0.12)',  label: 'Rolling' },
  '🌿': { border: 'rgba(134,197,94,0.7)', bg: 'rgba(134,197,94,0.12)', label: 'Herbal' },
  '🩹': { border: 'rgba(34,197,94,0.8)',  bg: 'rgba(34,197,94,0.15)', label: 'NRT' },
  '🟡': { border: 'rgba(34,197,94,0.8)',  bg: 'rgba(34,197,94,0.15)', label: 'NRT' },
  '🔵': { border: 'rgba(34,197,94,0.8)',  bg: 'rgba(34,197,94,0.15)', label: 'NRT' },
  '🟦': { border: 'rgba(34,197,94,0.8)',  bg: 'rgba(34,197,94,0.15)', label: 'NRT' },
  '🌬️': { border: 'rgba(34,197,94,0.8)',  bg: 'rgba(34,197,94,0.15)', label: 'NRT' },
}
const DEFAULT_COLOR = { border: 'rgba(156,163,175,0.8)', bg: 'rgba(156,163,175,0.15)', label: 'Other' }

// Render emoji to a canvas for use as Chart.js point icons
const emojiCache = new Map()
function emojiIcon(emoji, size = 14) {
  if (emojiCache.has(emoji)) return emojiCache.get(emoji)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.font = `${size - 2}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + 1)
  emojiCache.set(emoji, canvas)
  return canvas
}

function entryColor(entry) {
  if (entry.isNRT) return CAT_COLORS['🩹']
  return CAT_COLORS[entry.emoji] || DEFAULT_COLOR
}

const chartData = computed(() => {
  const hl = profileStore.halfLifeH
  const now = time.now
  const windowStart = now - SAMPLES * STEP_MS
  const allEntries = [...logStore.log, ...sessionsStore.activeSessionEntries]

  // Only include entries that could still contribute nicotine in the 24h window
  const relevantEntries = allEntries.filter(e => e.ts <= now && nicotineFromEntry(e, windowStart, hl) > 0.001 || e.ts >= windowStart)

  // Group entries by color key (category)
  const groups = new Map()
  for (const e of relevantEntries) {
    const c = entryColor(e)
    const key = c.label
    if (!groups.has(key)) groups.set(key, { color: c, entries: [] })
    groups.get(key).entries.push(e)
  }

  // Sample time points
  const labels = []
  const times = []
  for (let i = SAMPLES; i >= 0; i--) {
    const t = now - i * STEP_MS
    times.push(t)
    labels.push(new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
  }

  // Create stacked area dataset per category
  const datasets = []
  for (const [key, { color, entries }] of groups) {
    const data = times.map(t => Math.max(0, entries.reduce((s, e) => s + nicotineFromEntry(e, t, hl), 0)))
    // Skip categories that contribute nothing visible
    if (data.every(v => v < 0.005)) continue
    datasets.push({
      label: key,
      data,
      borderColor: color.border,
      backgroundColor: color.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1,
    })
  }

  // Usage markers — dots at the time and total level of each usage in window
  const markers = relevantEntries
    .filter(e => e.ts >= windowStart && e.ts <= now)
    .map(e => {
      // Find nearest sample index
      const idx = Math.round((e.ts - windowStart) / STEP_MS)
      const clampedIdx = Math.max(0, Math.min(SAMPLES, idx))
      // Total nicotine at that moment
      const level = allEntries.reduce((s, en) => s + nicotineFromEntry(en, e.ts, hl), 0)
      return { idx: clampedIdx, level: Math.max(0, level), emoji: e.emoji }
    })

  if (markers.length) {
    const markerData = new Array(SAMPLES + 1).fill(null)
    const markerEmojis = new Array(SAMPLES + 1).fill(null)
    for (const m of markers) {
      markerData[m.idx] = m.level
      markerEmojis[m.idx] = m.emoji
    }
    datasets.push({
      label: 'usage',
      data: markerData,
      pointStyle: markerData.map((v, i) => v !== null && markerEmojis[i] ? emojiIcon(markerEmojis[i]) : false),
      pointRadius: markerData.map(v => v !== null ? 7 : 0),
      showLine: false,
      fill: false,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    })
  }

  // If no data at all, show flat line
  if (!datasets.length) {
    datasets.push({
      data: new Array(SAMPLES + 1).fill(0),
      borderColor: 'rgba(99,182,255,0.3)',
      backgroundColor: 'rgba(99,182,255,0.05)',
      fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1,
    })
  }

  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      filter: item => item.dataset.label !== 'usage',
      mode: 'index',
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} mg`,
        footer: items => {
          const total = items.reduce((s, i) => s + i.parsed.y, 0)
          return `total: ${total.toFixed(2)} mg`
        },
      },
    },
  },
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 6, font: { size: 9 }, color: 'rgba(150,150,150,0.5)' },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: 'rgba(150,150,150,0.1)' },
      ticks: { maxTicksLimit: 4, font: { size: 9 }, color: 'rgba(150,150,150,0.5)' },
    },
  },
}

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
