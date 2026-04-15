import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useTimeStore } from './time.js'

const STORAGE_KEY = 'nicquitin-taper'

// All single and combo patch options sorted by hourly delivery rate (descending).
// Mixed-duration combos show the rate during the overlapping window.
// Half patches assume a clean 50/50 matrix cut.
export const DELIVERY_TABLE = [
  { rank: 1,  combo: '25mg (16h)',                  totalMg: 25,   hourlyRate: 1.56, durationH: 16, products: ['nicorette-25-16h'] },
  { rank: 2,  combo: '½ 25mg + 10mg (16h)',         totalMg: 22.5, hourlyRate: 1.41, durationH: 16, products: ['nicorette-25-16h-half', 'nicorette-10-16h'] },
  { rank: 3,  combo: '½ 25mg + ½ 15mg (16h)',       totalMg: 20,   hourlyRate: 1.25, durationH: 16, products: ['nicorette-25-16h-half', 'nicorette-15-16h-half'] },
  { rank: 4,  combo: '15mg + ½ 10mg (16h)',          totalMg: 20,   hourlyRate: 1.25, durationH: 16, products: ['nicorette-15-16h', 'nicorette-10-16h-half'] },
  { rank: 5,  combo: '15mg (16h)',                   totalMg: 15,   hourlyRate: 0.94, durationH: 16, products: ['nicorette-15-16h'] },
  { rank: 6,  combo: '21mg (24h)',                   totalMg: 21,   hourlyRate: 0.88, durationH: 24, products: ['niquitin-21-24h'] },
  { rank: 7,  combo: '10mg (16h) + ½ 14mg (24h)',   totalMg: 17,   hourlyRate: 0.92, durationH: 16, note: '0.29 mg/h overnight from 24h patch', products: ['nicorette-10-16h', 'niquitin-14-24h-half'] },
  { rank: 8,  combo: '½ 25mg (16h)',                 totalMg: 12.5, hourlyRate: 0.78, durationH: 16, products: ['nicorette-25-16h-half'] },
  { rank: 9,  combo: '½ 15mg + ½ 10mg (16h)',       totalMg: 12.5, hourlyRate: 0.78, durationH: 16, products: ['nicorette-15-16h-half', 'nicorette-10-16h-half'] },
  { rank: 10, combo: '10mg (16h)',                   totalMg: 10,   hourlyRate: 0.63, durationH: 16, products: ['nicorette-10-16h'] },
  { rank: 11, combo: '14mg (24h)',                   totalMg: 14,   hourlyRate: 0.58, durationH: 24, products: ['niquitin-14-24h'] },
  { rank: 12, combo: '½ 15mg (16h)',                 totalMg: 7.5,  hourlyRate: 0.47, durationH: 16, products: ['nicorette-15-16h-half'] },
  { rank: 13, combo: '½ 21mg (24h)',                 totalMg: 10.5, hourlyRate: 0.44, durationH: 24, products: ['niquitin-21-24h-half'] },
  { rank: 14, combo: '½ 10mg (16h)',                 totalMg: 5,    hourlyRate: 0.31, durationH: 16, products: ['nicorette-10-16h-half'] },
  { rank: 15, combo: '½ 14mg (24h)',                 totalMg: 7,    hourlyRate: 0.29, durationH: 24, products: ['niquitin-14-24h-half'] },
]

// Default 8-phase "Glide to Zero" plan.
// Each phase references a rank from the delivery table.
// daysMin = minimum days to stay (receptor downregulation needs ~5 days).
export const DEFAULT_PLAN = [
  { phase: 1, rank: 1,  daysMin: 5, label: 'Full Strength' },
  { phase: 2, rank: 3,  daysMin: 5, label: 'First Cut' },
  { phase: 3, rank: 5,  daysMin: 5, label: 'Mid Dose' },
  { phase: 4, rank: 6,  daysMin: 5, label: '24h Switch' },
  { phase: 5, rank: 10, daysMin: 5, label: 'Low Dose' },
  { phase: 6, rank: 11, daysMin: 5, label: 'Taper Down' },
  { phase: 7, rank: 13, daysMin: 5, label: 'Half 24h' },
  { phase: 8, rank: 15, daysMin: 5, label: 'Exit' },
]

function deliveryForRank(rank) {
  return DELIVERY_TABLE.find(d => d.rank === rank) ?? null
}

export const useTaperStore = defineStore('taper', () => {
  const time = useTimeStore()

  const state = ref({
    active: false,         // whether a taper plan is running
    planStartTs: null,     // when the whole plan started
    currentPhase: 0,       // index into the plan (0-based)
    phaseStartTs: null,    // when current phase started
    phases: [],            // the plan phases (copy of DEFAULT_PLAN, customisable)
    phaseDays: {},         // overridden day counts per phase index, e.g. { 2: 7 }
  })

  // ─── Computed ────────────────────────────────────────────────────────────────

  const plan = computed(() => {
    return (state.value.phases.length ? state.value.phases : DEFAULT_PLAN).map((p, i) => {
      const delivery = deliveryForRank(p.rank)
      const days = state.value.phaseDays[i] ?? p.daysMin
      return { ...p, ...delivery, days, index: i }
    })
  })

  const currentPhaseData = computed(() => plan.value[state.value.currentPhase] ?? null)

  const totalDays = computed(() => plan.value.reduce((sum, p) => sum + p.days, 0))

  const dayInPlan = computed(() => {
    if (!state.value.active || !state.value.planStartTs) return 0
    return Math.floor((time.now - state.value.planStartTs) / 86_400_000) + 1
  })

  const dayInPhase = computed(() => {
    if (!state.value.active || !state.value.phaseStartTs) return 0
    return Math.floor((time.now - state.value.phaseStartTs) / 86_400_000) + 1
  })

  const daysLeftInPhase = computed(() => {
    if (!currentPhaseData.value) return 0
    return Math.max(0, currentPhaseData.value.days - dayInPhase.value)
  })

  const phaseProgress = computed(() => {
    if (!currentPhaseData.value) return 0
    return Math.min(1, dayInPhase.value / currentPhaseData.value.days)
  })

  const overallProgress = computed(() => {
    if (!state.value.active) return 0
    const completedDays = plan.value
      .slice(0, state.value.currentPhase)
      .reduce((sum, p) => sum + p.days, 0) + dayInPhase.value
    return Math.min(1, completedDays / totalDays.value)
  })

  const isComplete = computed(() =>
    state.value.active && state.value.currentPhase >= plan.value.length
  )

  const estimatedEndTs = computed(() => {
    if (!state.value.planStartTs) return null
    return state.value.planStartTs + totalDays.value * 86_400_000
  })

  // ─── Shopping list ───────────────────────────────────────────────────────────

  const shoppingList = computed(() => {
    // Count how many of each purchasable patch pack is needed.
    // A 7-patch pack covers 7 full days or 14 half-patch days.
    const needs = {}
    for (const phase of plan.value) {
      if (!phase.products) continue
      for (const pid of phase.products) {
        // Determine the base product (remove -half suffix for purchasing)
        const basePid = pid.replace(/-half$/, '')
        const isHalf = pid.endsWith('-half')
        const patchDays = isHalf ? phase.days / 2 : phase.days // half patches: 1 patch = 2 days
        if (!needs[basePid]) needs[basePid] = { id: basePid, days: 0 }
        needs[basePid].days += patchDays
      }
    }
    return Object.values(needs).map(n => ({
      ...n,
      packs: Math.ceil(n.days / 7), // 7 patches per pack
    }))
  })

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function startPlan(customPhases) {
    const now = Date.now()
    state.value = {
      active: true,
      planStartTs: now,
      currentPhase: 0,
      phaseStartTs: now,
      phases: customPhases || [...DEFAULT_PLAN],
      phaseDays: {},
    }
    _persist()
  }

  function advancePhase() {
    if (state.value.currentPhase >= plan.value.length - 1) {
      state.value.currentPhase = plan.value.length // mark complete
    } else {
      state.value.currentPhase++
      state.value.phaseStartTs = Date.now()
    }
    _persist()
  }

  function setPhase(index) {
    if (index < 0 || index >= plan.value.length) return
    state.value.currentPhase = index
    state.value.phaseStartTs = Date.now()
    _persist()
  }

  function setPhaseDays(phaseIndex, days) {
    state.value.phaseDays = { ...state.value.phaseDays, [phaseIndex]: days }
    _persist()
  }

  function stopPlan() {
    state.value.active = false
    _persist()
  }

  function _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
  }

  function load() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) state.value = { ...state.value, ...JSON.parse(saved) }
  }

  return {
    state, plan, currentPhaseData, totalDays,
    dayInPlan, dayInPhase, daysLeftInPhase, phaseProgress, overallProgress,
    isComplete, estimatedEndTs, shoppingList,
    startPlan, advancePhase, setPhase, setPhaseDays, stopPlan,
    load,
  }
})
