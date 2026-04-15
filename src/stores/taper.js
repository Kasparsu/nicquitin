import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useTimeStore } from './time.js'
import { useLogStore } from './log.js'

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
  { phase: 1, rank: 1,  daysMin: 4, label: 'Full Strength' },
  { phase: 2, rank: 3,  daysMin: 4, label: 'First Cut' },
  { phase: 3, rank: 5,  daysMin: 4, label: 'Mid Dose' },
  { phase: 4, rank: 6,  daysMin: 4, label: '24h Switch' },
  { phase: 5, rank: 10, daysMin: 4, label: 'Low Dose' },
  { phase: 6, rank: 11, daysMin: 4, label: 'Taper Down' },
  { phase: 7, rank: 13, daysMin: 4, label: 'Half 24h' },
  { phase: 8, rank: 15, daysMin: 4, label: 'Exit' },
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

  // ─── Usage-based estimation ──────────────────────────────────────────────────

  // Match a set of product IDs to the best-fitting rank in the delivery table.
  function _matchProducts(productIds) {
    const ids = new Set(productIds)
    // Exact match first
    for (const d of DELIVERY_TABLE) {
      if (d.products.length === ids.size && d.products.every(p => ids.has(p))) return d
    }
    // Partial / closest: score by overlap
    let best = null, bestScore = -1
    for (const d of DELIVERY_TABLE) {
      const overlap = d.products.filter(p => ids.has(p)).length
      const extra   = [...ids].filter(p => !d.products.includes(p)).length
      const score   = overlap - extra * 0.5
      if (score > bestScore || (score === bestScore && best && d.products.length < best.products.length)) {
        best = d; bestScore = score
      }
    }
    return bestScore > 0 ? best : null
  }

  const usageEstimate = computed(() => {
    const logStore = useLogStore()
    const nrtEntries = logStore.log.filter(e => e.isNRT)
    if (!nrtEntries.length) return null

    // Group NRT entries by calendar day, collecting product IDs
    const dayBuckets = {}
    for (const e of nrtEntries) {
      const day = new Date(e.ts).toDateString()
      if (!dayBuckets[day]) dayBuckets[day] = { day, ts: e.ts, products: new Set() }
      dayBuckets[day].products.add(e.productId)
      // Keep most recent ts for sorting
      if (e.ts > dayBuckets[day].ts) dayBuckets[day].ts = e.ts
    }

    // Sort days oldest-first so we can walk the timeline forward
    const days = Object.values(dayBuckets).sort((a, b) => a.ts - b.ts)
    if (!days.length) return null

    // Match each day to a delivery rank
    const matched = days.map(d => ({
      ...d,
      rank: _matchProducts(d.products),
    }))

    // Walk through days to detect phases.
    // A "phase segment" is consecutive days at the same rank.
    const segments = []
    let current = null
    for (const d of matched) {
      const rankNum = d.rank?.rank ?? null
      if (current && current.rankNum === rankNum) {
        current.days++
        current.lastTs = d.ts
      } else {
        current = { rankNum, rank: d.rank, days: 1, firstTs: d.ts, lastTs: d.ts }
        segments.push(current)
      }
    }

    // Current = last segment (most recent usage)
    const latest = segments[segments.length - 1]
    if (!latest?.rank) return null

    // Map current rank to a plan phase
    const planPhases = plan.value
    let matchedPhase = planPhases.find(p => p.rank === latest.rankNum) ?? null
    if (!matchedPhase) {
      // Closest phase by hourly rate
      let bestDiff = Infinity
      for (const p of planPhases) {
        const diff = Math.abs((p.hourlyRate ?? 0) - latest.rank.hourlyRate)
        if (diff < bestDiff) { bestDiff = diff; matchedPhase = p }
      }
    }

    // Build a history of phase transitions
    const history = segments
      .filter(s => s.rank)
      .map(s => {
        const phase = planPhases.find(p => p.rank === s.rankNum) ?? null
        return {
          rank: s.rank,
          phase,
          days: s.days,
          from: new Date(s.firstTs).toLocaleDateString(),
        }
      })

    return {
      currentRank: latest.rank,
      daysAtLevel: latest.days,
      matchedPhase,
      totalDaysLogged: days.length,
      history,
    }
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

  function adjustPhaseDay(delta) {
    if (!state.value.phaseStartTs) return
    state.value.phaseStartTs -= delta * 86_400_000
    if (!state.value.planStartTs) return
    state.value.planStartTs -= delta * 86_400_000
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
    isComplete, estimatedEndTs, shoppingList, usageEstimate,
    startPlan, advancePhase, setPhase, setPhaseDays, adjustPhaseDay, stopPlan,
    load,
  }
})
