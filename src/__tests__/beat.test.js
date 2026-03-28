import { describe, it, expect } from 'vitest'
import {
  BEAT_STEP,
  INITIAL_MULTIPLIER,
  BEAT_MULTIPLIER_CAP,
  computeRecentSuccessRate,
  applyBeatResult,
} from '../lib/beat.js'

// ─── computeRecentSuccessRate ─────────────────────────────────────────────────

describe('computeRecentSuccessRate', () => {
  it('returns null for empty array', () => {
    expect(computeRecentSuccessRate([])).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(computeRecentSuccessRate(undefined)).toBeNull()
  })

  it('returns null when fewer than 3 outcomes', () => {
    expect(computeRecentSuccessRate([true, false])).toBeNull()
  })

  it('returns 1.0 for all successes', () => {
    expect(computeRecentSuccessRate([true, true, true])).toBe(1)
  })

  it('returns 0.0 for all failures', () => {
    expect(computeRecentSuccessRate([false, false, false])).toBe(0)
  })

  it('returns 0.5 for half successes', () => {
    expect(computeRecentSuccessRate([true, false, true, false])).toBe(0.5)
  })

  it('works with 10 outcomes', () => {
    const outcomes = [true, true, true, true, true, false, false, false, false, false]
    expect(computeRecentSuccessRate(outcomes)).toBe(0.5)
  })
})

// ─── applyBeatResult ──────────────────────────────────────────────────────────

const baseState = {
  multiplier:     INITIAL_MULTIPLIER,
  totalBeats:     0,
  totalAttempts:  0,
  currentStreak:  0,
  bestStreak:     0,
  bestIntervalMs: 0,
  recentOutcomes: [],
}

const avgMs  = 60 * 60_000   // 1 hour average
const target = avgMs * INITIAL_MULTIPLIER

describe('applyBeatResult — success', () => {
  const next = applyBeatResult(target + 1, avgMs, baseState)

  it('increments totalBeats', () => {
    expect(next.totalBeats).toBe(1)
  })

  it('increments totalAttempts', () => {
    expect(next.totalAttempts).toBe(1)
  })

  it('increments currentStreak', () => {
    expect(next.currentStreak).toBe(1)
  })

  it('updates bestStreak', () => {
    expect(next.bestStreak).toBe(1)
  })

  it('updates bestIntervalMs', () => {
    expect(next.bestIntervalMs).toBe(target + 1)
  })

  it('increases multiplier by at least BEAT_STEP', () => {
    expect(next.multiplier).toBeGreaterThanOrEqual(
      parseFloat((INITIAL_MULTIPLIER + BEAT_STEP).toFixed(4))
    )
  })

  it('records the outcome as true in recentOutcomes', () => {
    expect(next.recentOutcomes.at(-1)).toBe(true)
  })

  it('does not mutate the input state', () => {
    expect(baseState.totalBeats).toBe(0)
    expect(baseState.multiplier).toBe(INITIAL_MULTIPLIER)
    expect(baseState.recentOutcomes).toHaveLength(0)
  })
})

describe('applyBeatResult — failure', () => {
  const next = applyBeatResult(target - 1, avgMs, baseState)

  it('does not increment totalBeats', () => {
    expect(next.totalBeats).toBe(0)
  })

  it('increments totalAttempts', () => {
    expect(next.totalAttempts).toBe(1)
  })

  it('resets currentStreak to 0', () => {
    expect(next.currentStreak).toBe(0)
  })

  it('records the outcome as false in recentOutcomes', () => {
    expect(next.recentOutcomes.at(-1)).toBe(false)
  })

  it('does not reduce multiplier when fewer than 3 outcomes (not enough data)', () => {
    expect(next.multiplier).toBe(INITIAL_MULTIPLIER)
  })
})

describe('applyBeatResult — multiplier ease-back when struggling', () => {
  it('reduces multiplier when recent success rate < 40%', () => {
    // Seed state with 9 failures already in recentOutcomes
    const struggling = {
      ...baseState,
      multiplier: INITIAL_MULTIPLIER + 3 * BEAT_STEP,  // elevated from past wins
      recentOutcomes: [false, false, false, false, false, false, false, false, false], // 9 failures
    }
    const next = applyBeatResult(target - 1, avgMs, struggling)
    expect(next.multiplier).toBeLessThan(struggling.multiplier)
  })

  it('never reduces multiplier below INITIAL_MULTIPLIER', () => {
    const atFloor = { ...baseState, recentOutcomes: Array(9).fill(false) }
    const next    = applyBeatResult(target - 1, avgMs, atFloor)
    expect(next.multiplier).toBeGreaterThanOrEqual(INITIAL_MULTIPLIER)
  })

  it('does not reduce multiplier when success rate is exactly 40%', () => {
    // 4 out of 10 = 40% exactly — threshold is < 0.4 so no reduction
    const state = {
      ...baseState,
      multiplier: INITIAL_MULTIPLIER + BEAT_STEP,
      recentOutcomes: [true, true, true, true, false, false, false, false, false, false],
    }
    // Next outcome is a failure; recentRate will be 4/11 ≈ 0.36 < 0.4 after adding
    // Actually let me think: 10 outcomes kept. Adding failure: drop oldest, keep last 10:
    // [true, true, true, true, false, false, false, false, false, false] → add false →
    // slice(-10) = [true, true, true, false, false, false, false, false, false, false] = 3/10 = 0.3 < 0.4
    // So this will reduce. Let's test with rate = 0.4 case properly.
    // To get exactly 0.4 after adding failure: need 4/10 → start with [t,t,t,t,t,f,f,f,f,f] (5/9→after=4/10=0.4)
    const state04 = {
      ...baseState,
      multiplier: INITIAL_MULTIPLIER + BEAT_STEP,
      recentOutcomes: [true, true, true, true, true, false, false, false, false], // 9 items, adding 1 failure = 4/10 = 0.4
    }
    const next04 = applyBeatResult(target - 1, avgMs, state04)
    // recentRate = 4/10 = 0.4, not < 0.4, so no reduction
    expect(next04.multiplier).toBe(state04.multiplier)
  })
})

describe('applyBeatResult — hot streak bonus', () => {
  it('adds a streak bonus after multiple consecutive successes', () => {
    let state = baseState
    // Build up a 5-beat streak
    for (let i = 0; i < 5; i++) {
      state = applyBeatResult(state.multiplier * avgMs + 1, avgMs, state)
    }
    // After 5 beats, streak = 5, bonus = min(5*0.005, 0.025) = 0.025
    // Total increase should be > 5 * BEAT_STEP
    expect(state.multiplier).toBeGreaterThan(INITIAL_MULTIPLIER + 5 * BEAT_STEP)
  })

  it('streak bonus is capped at 0.025', () => {
    let state = { ...baseState, currentStreak: 100 }
    const prev = state.multiplier
    state = applyBeatResult(state.multiplier * avgMs + 1, avgMs, state)
    const increase = state.multiplier - prev
    // BEAT_STEP + max_bonus = 0.08 + 0.025 = 0.105
    expect(increase).toBeLessThanOrEqual(BEAT_STEP + 0.025 + 0.0001) // float tolerance
  })
})

describe('applyBeatResult — multiplier cap', () => {
  it('caps multiplier at BEAT_MULTIPLIER_CAP', () => {
    const atCap = { ...baseState, multiplier: BEAT_MULTIPLIER_CAP - 0.001 }
    const next  = applyBeatResult(atCap.multiplier * avgMs + 1, avgMs, atCap)
    expect(next.multiplier).toBe(BEAT_MULTIPLIER_CAP)
  })
})

describe('applyBeatResult — recentOutcomes rolling window', () => {
  it('keeps at most 10 outcomes', () => {
    let state = { ...baseState, recentOutcomes: Array(10).fill(true) }
    const next = applyBeatResult(target + 1, avgMs, state)
    expect(next.recentOutcomes).toHaveLength(10)
  })

  it('drops oldest outcome when window is full', () => {
    const state = { ...baseState, recentOutcomes: Array(10).fill(false) }
    const next  = applyBeatResult(target + 1, avgMs, state)  // success → adds true
    expect(next.recentOutcomes.at(-1)).toBe(true)
    expect(next.recentOutcomes).toHaveLength(10)
  })
})

describe('applyBeatResult — bestStreak tracking', () => {
  it('updates bestStreak only when current streak exceeds it', () => {
    let state = { ...baseState, bestStreak: 5, currentStreak: 3 }
    state = applyBeatResult(state.multiplier * avgMs + 1, avgMs, state)
    expect(state.bestStreak).toBe(5) // 4 < 5, no update
  })

  it('updates bestStreak when a new record is set', () => {
    let state = { ...baseState, bestStreak: 3, currentStreak: 3 }
    state = applyBeatResult(state.multiplier * avgMs + 1, avgMs, state)
    expect(state.bestStreak).toBe(4) // new record
  })
})
