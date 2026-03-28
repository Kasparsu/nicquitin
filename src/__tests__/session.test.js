import { describe, it, expect } from 'vitest'
import {
  computeSessionProgress,
  computeSessionRemainingMs,
  computeSessionEstimatedDose,
  computeStopSessionDose,
} from '../lib/session.js'

const now     = 1_700_000_000_000
const product = { nicotineMg: 14, releaseDurationH: 16 }

// ─── computeSessionProgress ───────────────────────────────────────────────────

describe('computeSessionProgress', () => {
  it('returns 0 at the moment the session starts', () => {
    expect(computeSessionProgress({ startTs: now, reuseCount: 0 }, product, now)).toBe(0)
  })

  it('returns 0.5 at the halfway point', () => {
    const halfMs = now + (product.releaseDurationH / 2) * 3_600_000
    expect(computeSessionProgress({ startTs: now, reuseCount: 0 }, product, halfMs)).toBeCloseTo(0.5)
  })

  it('returns 1.0 at exactly the release duration', () => {
    const endMs = now + product.releaseDurationH * 3_600_000
    expect(computeSessionProgress({ startTs: now, reuseCount: 0 }, product, endMs)).toBeCloseTo(1.0)
  })

  it('returns > 1 when session has run past its duration', () => {
    const lateMs = now + (product.releaseDurationH + 4) * 3_600_000
    expect(computeSessionProgress({ startTs: now, reuseCount: 0 }, product, lateMs)).toBeGreaterThan(1)
  })

  it('returns 0 when product has no releaseDurationH', () => {
    const instant = { nicotineMg: 1, releaseDurationH: 0 }
    expect(computeSessionProgress({ startTs: now, reuseCount: 0 }, instant, now + 3_600_000)).toBe(0)
  })

  it('returns 0 for null session', () => {
    expect(computeSessionProgress(null, product, now)).toBe(0)
  })

  it('returns 0 for null product', () => {
    expect(computeSessionProgress({ startTs: now, reuseCount: 0 }, null, now)).toBe(0)
  })
})

// ─── computeSessionRemainingMs ────────────────────────────────────────────────

describe('computeSessionRemainingMs', () => {
  it('returns full duration at start', () => {
    const expected = product.releaseDurationH * 3_600_000
    expect(computeSessionRemainingMs({ startTs: now, reuseCount: 0 }, product, now)).toBe(expected)
  })

  it('returns half duration at the halfway point', () => {
    const halfMs   = now + (product.releaseDurationH / 2) * 3_600_000
    const expected = (product.releaseDurationH / 2) * 3_600_000
    expect(computeSessionRemainingMs({ startTs: now, reuseCount: 0 }, product, halfMs)).toBeCloseTo(expected)
  })

  it('returns 0 when session has ended', () => {
    const afterMs = now + (product.releaseDurationH + 1) * 3_600_000
    expect(computeSessionRemainingMs({ startTs: now, reuseCount: 0 }, product, afterMs)).toBe(0)
  })

  it('returns 0 for null session', () => {
    expect(computeSessionRemainingMs(null, product, now)).toBe(0)
  })

  it('returns 0 for product with no releaseDurationH', () => {
    const instant = { nicotineMg: 1, releaseDurationH: 0 }
    expect(computeSessionRemainingMs({ startTs: now, reuseCount: 0 }, instant, now)).toBe(0)
  })
})

// ─── computeSessionEstimatedDose ─────────────────────────────────────────────

describe('computeSessionEstimatedDose', () => {
  it('returns 0 at the start of a session', () => {
    expect(computeSessionEstimatedDose({ startTs: now, reuseCount: 0 }, product, now)).toBe(0)
  })

  it('returns the full dose when session duration has elapsed', () => {
    const endMs = now + product.releaseDurationH * 3_600_000
    expect(computeSessionEstimatedDose({ startTs: now, reuseCount: 0 }, product, endMs))
      .toBeCloseTo(product.nicotineMg)
  })

  it('is capped at the full dose when session runs over', () => {
    const lateMs = now + (product.releaseDurationH * 2) * 3_600_000
    expect(computeSessionEstimatedDose({ startTs: now, reuseCount: 0 }, product, lateMs))
      .toBeCloseTo(product.nicotineMg)
  })

  it('halves the dose for reuseCount = 1', () => {
    const endMs = now + product.releaseDurationH * 3_600_000
    const dose1 = computeSessionEstimatedDose({ startTs: now, reuseCount: 1 }, product, endMs)
    expect(dose1).toBeCloseTo(product.nicotineMg * 0.5)
  })

  it('quarters the dose for reuseCount = 2', () => {
    const endMs = now + product.releaseDurationH * 3_600_000
    const dose2 = computeSessionEstimatedDose({ startTs: now, reuseCount: 2 }, product, endMs)
    expect(dose2).toBeCloseTo(product.nicotineMg * 0.25)
  })

  it('returns 0 for null session', () => {
    expect(computeSessionEstimatedDose(null, product, now)).toBe(0)
  })

  it('returns 0 for null product', () => {
    expect(computeSessionEstimatedDose({ startTs: now, reuseCount: 0 }, null, now)).toBe(0)
  })
})

// ─── computeStopSessionDose ───────────────────────────────────────────────────

describe('computeStopSessionDose', () => {
  it('returns full dose when stopped at full duration', () => {
    const stopTs = now + product.releaseDurationH * 3_600_000
    expect(computeStopSessionDose({ startTs: now, reuseCount: 0 }, product, stopTs))
      .toBeCloseTo(product.nicotineMg)
  })

  it('returns half dose when stopped at half duration', () => {
    const stopTs = now + (product.releaseDurationH / 2) * 3_600_000
    expect(computeStopSessionDose({ startTs: now, reuseCount: 0 }, product, stopTs))
      .toBeCloseTo(product.nicotineMg / 2)
  })

  it('does not exceed full dose even when stopped late', () => {
    const stopTs = now + (product.releaseDurationH * 3) * 3_600_000
    expect(computeStopSessionDose({ startTs: now, reuseCount: 0 }, product, stopTs))
      .toBeCloseTo(product.nicotineMg)
  })

  it('applies 1.08× multiplier when swallowed = true', () => {
    const stopTs     = now + product.releaseDurationH * 3_600_000
    const spit       = computeStopSessionDose({ startTs: now, reuseCount: 0 }, product, stopTs, { swallowed: false })
    const swallowed  = computeStopSessionDose({ startTs: now, reuseCount: 0 }, product, stopTs, { swallowed: true })
    expect(swallowed).toBeCloseTo(spit * 1.08)
  })

  it('halves dose for reuseCount = 1', () => {
    const stopTs   = now + product.releaseDurationH * 3_600_000
    const fresh    = computeStopSessionDose({ startTs: now, reuseCount: 0 }, product, stopTs)
    const reused   = computeStopSessionDose({ startTs: now, reuseCount: 1 }, product, stopTs)
    expect(reused).toBeCloseTo(fresh * 0.5)
  })

  it('combines reuse + swallow modifiers', () => {
    const stopTs    = now + product.releaseDurationH * 3_600_000
    const combined  = computeStopSessionDose({ startTs: now, reuseCount: 1 }, product, stopTs, { swallowed: true })
    expect(combined).toBeCloseTo(product.nicotineMg * 0.5 * 1.08)
  })

  it('uses releaseDurationH = 1 as minimum when product.releaseDurationH is 0', () => {
    const noD    = { nicotineMg: 10, releaseDurationH: 0 }
    const stopTs = now + 3_600_000  // 1 hour
    // With floor of 1h, stopping after 1h = full dose
    expect(computeStopSessionDose({ startTs: now, reuseCount: 0 }, noD, stopTs))
      .toBeCloseTo(noD.nicotineMg)
  })
})
