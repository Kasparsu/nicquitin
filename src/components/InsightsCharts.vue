<template>
  <div v-if="log.length >= 2" class="space-y-4">

    <!-- Range selector -->
    <div class="flex gap-1 bg-base-300 rounded-xl p-1">
      <button
        v-for="r in ranges" :key="r.id"
        class="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors"
        :class="range === r.id
          ? 'bg-base-100 text-base-content shadow-sm'
          : 'text-base-content/50 hover:text-base-content/80'"
        @click="range = r.id"
      >{{ r.label }}</button>
    </div>

    <!-- Daily usage count -->
    <div class="card bg-base-100 shadow">
      <div class="card-body gap-2 py-4">
        <h2 class="card-title text-base">daily usage</h2>
        <Bar :data="dailyUsageData" :options="barOpts" class="max-h-48" />
      </div>
    </div>

    <!-- Daily nicotine intake -->
    <div class="card bg-base-100 shadow">
      <div class="card-body gap-2 py-4">
        <h2 class="card-title text-base">daily nicotine (mg)</h2>
        <Line :data="dailyMgData" :options="lineOpts" class="max-h-48" />
      </div>
    </div>

    <!-- Usage by hour of day -->
    <div class="card bg-base-100 shadow">
      <div class="card-body gap-2 py-4">
        <h2 class="card-title text-base">time of day</h2>
        <Bar :data="hourlyData" :options="hourlyOpts" class="max-h-48" />
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '../stores/log.js'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

const logStore = useLogStore()
const { log } = storeToRefs(logStore)

const ranges = [
  { id: '2w',  label: '2 weeks', days: 14 },
  { id: '3m',  label: '3 months', days: 90 },
  { id: '1y',  label: '1 year', days: 365 },
  { id: 'all', label: 'All time', days: null },
]
const range = ref('2w')

const rangeDays = computed(() => ranges.find(r => r.id === range.value)?.days ?? null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayLabel(date, totalDays) {
  if (totalDays > 90) return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  if (totalDays > 30) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getDayRange() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (rangeDays.value !== null) {
    const days = []
    for (let i = rangeDays.value - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push(d)
    }
    return days
  }

  // All time: from earliest log entry to today
  if (!log.value.length) return [now]
  const earliest = new Date(log.value[log.value.length - 1].ts)
  earliest.setHours(0, 0, 0, 0)
  const days = []
  const d = new Date(earliest)
  while (d <= now) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

// For large ranges, bucket days into weeks/months
function bucketDays(days) {
  const total = days.length
  if (total <= 31) return { days, labels: days.map(d => dayLabel(d, total)), type: 'day' }

  if (total <= 180) {
    // Weekly buckets
    const buckets = []
    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7)
      buckets.push({ start: slice[0], days: slice })
    }
    return {
      days: buckets,
      labels: buckets.map(b => dayLabel(b.start, total)),
      type: 'week',
    }
  }

  // Monthly buckets
  const buckets = []
  let current = null
  for (const d of days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!current || current.key !== key) {
      current = { key, start: d, days: [] }
      buckets.push(current)
    }
    current.days.push(d)
  }
  return {
    days: buckets,
    labels: buckets.map(b => b.start.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })),
    type: 'month',
  }
}

function bucketEntries(entries, bucketed) {
  if (bucketed.type === 'day') {
    return bucketed.days.map(d => entries.filter(e => {
      const ed = new Date(e.ts); ed.setHours(0, 0, 0, 0)
      return ed.getTime() === d.getTime()
    }))
  }
  return bucketed.days.map(b => entries.filter(e => {
    const ed = new Date(e.ts); ed.setHours(0, 0, 0, 0)
    return b.days.some(d => d.getTime() === ed.getTime())
  }))
}

// ─── Shared style ─────────────────────────────────────────────────────────────

const gridColor = 'rgba(150,150,150,0.1)'
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { size: 10 } } },
  },
}

const barOpts = computed(() => ({
  ...baseOptions,
  scales: {
    ...baseOptions.scales,
    x: { ...baseOptions.scales.x, stacked: true, ticks: { ...baseOptions.scales.x.ticks, maxTicksLimit: rangeDays.value && rangeDays.value > 30 ? 12 : 14 } },
    y: { ...baseOptions.scales.y, stacked: true },
  },
}))
const lineOpts = computed(() => ({
  ...baseOptions,
  elements: { point: { radius: rangeDays.value && rangeDays.value > 30 ? 0 : 3 }, line: { tension: 0.3 } },
  scales: {
    ...baseOptions.scales,
    x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, maxTicksLimit: rangeDays.value && rangeDays.value > 30 ? 12 : 14 } },
  },
}))
const hourlyOpts = {
  ...baseOptions,
  scales: {
    ...baseOptions.scales,
    x: { ...baseOptions.scales.x, ticks: { font: { size: 9 } } },
  },
}

// ─── Daily usage count ────────────────────────────────────────────────────────

const dailyUsageData = computed(() => {
  const bucketed = bucketDays(getDayRange())
  const grouped = bucketEntries(log.value, bucketed)
  const counts = grouped.map(g => g.filter(e => !logStore.isEntryNRT(e)).length)
  const nrtCounts = grouped.map(g => g.filter(e => logStore.isEntryNRT(e)).length)

  return {
    labels: bucketed.labels,
    datasets: [
      { label: 'Habit', data: counts, backgroundColor: 'rgba(255,99,132,0.6)', borderRadius: 3 },
      { label: 'NRT', data: nrtCounts, backgroundColor: 'rgba(99,182,255,0.4)', borderRadius: 3 },
    ],
  }
})

// ─── Daily nicotine mg ────────────────────────────────────────────────────────

const dailyMgData = computed(() => {
  const bucketed = bucketDays(getDayRange())
  const grouped = bucketEntries(log.value, bucketed)
  const habitMg = grouped.map(g => g.filter(e => !logStore.isEntryNRT(e)).reduce((s, e) => s + (e.nicotineMg ?? 0), 0))
  const nrtMg = grouped.map(g => g.filter(e => logStore.isEntryNRT(e)).reduce((s, e) => s + (e.nicotineMg ?? 0), 0))

  return {
    labels: bucketed.labels,
    datasets: [
      { label: 'Habit mg', data: habitMg, borderColor: 'rgba(255,99,132,0.8)', backgroundColor: 'rgba(255,99,132,0.1)', fill: true },
      { label: 'NRT mg', data: nrtMg, borderColor: 'rgba(99,182,255,0.8)', backgroundColor: 'rgba(99,182,255,0.1)', fill: true },
    ],
  }
})

// ─── Usage by hour ────────────────────────────────────────────────────────────

const hourlyData = computed(() => {
  const cutoff = rangeDays.value !== null ? Date.now() - rangeDays.value * 86_400_000 : 0
  const filtered = log.value.filter(e => e.ts >= cutoff)

  const counts = new Array(24).fill(0)
  for (const e of filtered) {
    counts[new Date(e.ts).getHours()]++
  }

  const labels = Array.from({ length: 24 }, (_, h) => {
    if (h === 0) return '12a'
    if (h === 12) return '12p'
    return h < 12 ? `${h}a` : `${h - 12}p`
  })

  return {
    labels,
    datasets: [{
      label: 'Uses',
      data: counts,
      backgroundColor: counts.map(c => {
        const max = Math.max(...counts)
        const intensity = max > 0 ? c / max : 0
        return `rgba(168,85,247,${0.2 + intensity * 0.6})`
      }),
      borderRadius: 2,
    }],
  }
})
</script>
