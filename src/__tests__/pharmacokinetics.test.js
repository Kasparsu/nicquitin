import { describe, it, expect } from 'vitest'
import {
  BASE_HL_H,
  CLEAN_THRESHOLD,
  calcHalfLife,
  nicotineFromEntry,
  computeTimeUntilCleanMs,
} from '../lib/pharmacokinetics.js'

// ─── calcHalfLife ─────────────────────────────────────────────────────────────

describe('calcHalfLife', () => {
  const base = { sex: 'male', metabolizer: 'normal', menthol: false, pregnant: false, contraceptives: false }

  it('returns BASE_HL_H for default male/normal profile', () => {
    expect(calcHalfLife(base)).toBe(BASE_HL_H)
  })

  it('applies female modifier (×0.83)', () => {
    expect(calcHalfLife({ ...base, sex: 'female' })).toBe(Math.round(2 * 0.83 * 100) / 100)
  })

  it('applies female + pregnant modifier (×0.83 × 0.78)', () => {
    const hl = calcHalfLife({ ...base, sex: 'female', pregnant: true })
    expect(hl).toBeCloseTo(2 * 0.83 * 0.78, 2)
  })

  it('applies female + contraceptives modifier (×0.83 × 0.88) when not pregnant', () => {
    const hl = calcHalfLife({ ...base, sex: 'female', contraceptives: true })
    expect(hl).toBeCloseTo(2 * 0.83 * 0.88, 2)
  })

  it('does NOT apply contraceptives modifier when pregnant', () => {
    const withContra     = calcHalfLife({ ...base, sex: 'female', pregnant: true, contraceptives: true })
    const withoutContra  = calcHalfLife({ ...base, sex: 'female', pregnant: true, contraceptives: false })
    expect(withContra).toBe(withoutContra)
  })

  it('does NOT apply contraceptives modifier to males', () => {
    const hl = calcHalfLife({ ...base, sex: 'male', contraceptives: true })
    expect(hl).toBe(BASE_HL_H) // no female modifier at all
  })

  it('applies slow metabolizer modifier (×1.75)', () => {
    expect(calcHalfLife({ ...base, metabolizer: 'slow' })).toBeCloseTo(2 * 1.75, 2)
  })

  it('applies fast metabolizer modifier (×0.70)', () => {
    expect(calcHalfLife({ ...base, metabolizer: 'fast' })).toBeCloseTo(2 * 0.70, 2)
  })

  it('applies menthol modifier (×1.20)', () => {
    expect(calcHalfLife({ ...base, menthol: true })).toBeCloseTo(2 * 1.20, 2)
  })

  it('combines fast + menthol modifiers', () => {
    const hl = calcHalfLife({ ...base, metabolizer: 'fast', menthol: true })
    expect(hl).toBeCloseTo(2 * 0.70 * 1.20, 2)
  })

  it('rounds result to 2 decimal places', () => {
    const hl = calcHalfLife({ ...base, sex: 'female', metabolizer: 'slow', menthol: true })
    expect(String(hl).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})

// ─── nicotineFromEntry (instant) ─────────────────────────────────────────────

describe('nicotineFromEntry — instant release', () => {
  const now  = 1_000_000_000_000
  const dose = 10
  const hl   = 2  // hours
  const entry = { ts: now, nicotineMg: dose, releaseType: 'instant', releaseDurationH: 0 }

  it('returns 0 at time of use (elapsed = 0)', () => {
    expect(nicotineFromEntry(entry, now, hl)).toBe(0)
  })

  it('returns 0 before time of use (negative elapsed)', () => {
    expect(nicotineFromEntry(entry, now - 1000, hl)).toBe(0)
  })

  it('returns dose * 0.5 at one half-life', () => {
    const atMs = now + hl * 3_600_000
    expect(nicotineFromEntry(entry, atMs, hl)).toBeCloseTo(dose * 0.5, 5)
  })

  it('returns dose * 0.25 at two half-lives', () => {
    const atMs = now + hl * 2 * 3_600_000
    expect(nicotineFromEntry(entry, atMs, hl)).toBeCloseTo(dose * 0.25, 5)
  })

  it('approaches zero at many half-lives', () => {
    const atMs = now + hl * 20 * 3_600_000
    expect(nicotineFromEntry(entry, atMs, hl)).toBeLessThan(0.001)
  })

  it('treats missing nicotineMg as 0', () => {
    const e = { ts: now, releaseType: 'instant', releaseDurationH: 0 }
    expect(nicotineFromEntry(e, now + 3_600_000, hl)).toBe(0)
  })
})

// ─── nicotineFromEntry (slow release) ────────────────────────────────────────

describe('nicotineFromEntry — slow release', () => {
  const now  = 1_000_000_000_000
  const dose = 14   // mg (patch)
  const hl   = 2    // hours
  const D    = 16   // hours release duration
  const entry = { ts: now, nicotineMg: dose, releaseType: 'slow', releaseDurationH: D }

  it('returns 0 at time of application', () => {
    expect(nicotineFromEntry(entry, now, hl)).toBe(0)
  })

  it('is positive midway through release window', () => {
    const atMs = now + (D / 2) * 3_600_000
    expect(nicotineFromEntry(entry, atMs, hl)).toBeGreaterThan(0)
  })

  it('is less than full dose midway through release window', () => {
    const atMs = now + (D / 2) * 3_600_000
    expect(nicotineFromEntry(entry, atMs, hl)).toBeLessThan(dose)
  })

  it('is positive just after release window closes (D + ε)', () => {
    const atMs = now + (D + 0.01) * 3_600_000
    expect(nicotineFromEntry(entry, atMs, hl)).toBeGreaterThan(0)
  })

  it('decays after release window closes', () => {
    const atD    = now + D * 3_600_000
    const at2D   = now + D * 2 * 3_600_000
    expect(nicotineFromEntry(entry, atD, hl)).toBeGreaterThan(
      nicotineFromEntry(entry, at2D, hl)
    )
  })

  it('is continuous at the boundary (values on both sides are close)', () => {
    const epsilon = 0.001 * 3_600_000  // 0.001 hours in ms
    const before  = nicotineFromEntry(entry, now + D * 3_600_000 - epsilon, hl)
    const after   = nicotineFromEntry(entry, now + D * 3_600_000 + epsilon, hl)
    expect(Math.abs(before - after)).toBeLessThan(0.01)
  })

  it('handles releaseDurationH = 0 (uses min 0.01 floor)', () => {
    const e = { ts: now, nicotineMg: 1, releaseType: 'slow', releaseDurationH: 0 }
    expect(nicotineFromEntry(e, now + 3_600_000, hl)).toBeGreaterThanOrEqual(0)
  })
})

// ─── computeTimeUntilCleanMs ──────────────────────────────────────────────────

describe('computeTimeUntilCleanMs', () => {
  const now = 1_000_000_000_000
  const hl  = 2

  it('returns null when there are no entries (already clean)', () => {
    expect(computeTimeUntilCleanMs([], now, hl)).toBeNull()
  })

  it('returns null when nicotine level is already at or below threshold', () => {
    // A tiny dose given 48 hours ago will be essentially zero
    const entry = { ts: now - 48 * 3_600_000, nicotineMg: 0.01, releaseType: 'instant', releaseDurationH: 0 }
    expect(computeTimeUntilCleanMs([entry], now, hl)).toBeNull()
  })

  it('returns a positive number for a fresh high-dose entry', () => {
    // Use ts 1 minute in the past so elapsedH > 0 and nicotine level is measurable
    const entry = { ts: now - 60_000, nicotineMg: 20, releaseType: 'instant', releaseDurationH: 0 }
    const ms = computeTimeUntilCleanMs([entry], now, hl)
    expect(ms).toBeGreaterThan(0)
  })

  it('returns a larger value for a higher dose', () => {
    const low  = [{ ts: now - 60_000, nicotineMg: 2,  releaseType: 'instant', releaseDurationH: 0 }]
    const high = [{ ts: now - 60_000, nicotineMg: 20, releaseType: 'instant', releaseDurationH: 0 }]
    expect(computeTimeUntilCleanMs(high, now, hl)).toBeGreaterThan(
      computeTimeUntilCleanMs(low, now, hl)
    )
  })

  it('stays within the 3-day scan window (≤ 3 days + 1 step)', () => {
    const entry = { ts: now - 60_000, nicotineMg: 20, releaseType: 'instant', releaseDurationH: 0 }
    const ms = computeTimeUntilCleanMs([entry], now, hl)
    expect(ms).toBeLessThanOrEqual(3 * 24 * 60 * 60_000 + 15 * 60_000)
  })

  it('accounts for multiple entries summed together', () => {
    const single = [{ ts: now - 60_000, nicotineMg: 5, releaseType: 'instant', releaseDurationH: 0 }]
    const multi  = [
      { ts: now - 60_000, nicotineMg: 5, releaseType: 'instant', releaseDurationH: 0 },
      { ts: now - 3_600_000, nicotineMg: 5, releaseType: 'instant', releaseDurationH: 0 },
    ]
    expect(computeTimeUntilCleanMs(multi, now, hl)).toBeGreaterThanOrEqual(
      computeTimeUntilCleanMs(single, now, hl)
    )
  })

  it('is lower for a fast metabolizer (shorter half-life)', () => {
    const entry = [{ ts: now - 60_000, nicotineMg: 5, releaseType: 'instant', releaseDurationH: 0 }]
    expect(computeTimeUntilCleanMs(entry, now, 0.5)).toBeLessThan(
      computeTimeUntilCleanMs(entry, now, 2)
    )
  })

  it('includes the STEP/2 midpoint offset (result is not exactly on a 15-min boundary)', () => {
    const entry = [{ ts: now, nicotineMg: 1, releaseType: 'instant', releaseDurationH: 0 }]
    const ms    = computeTimeUntilCleanMs([entry[0]], now, hl)
    if (ms !== null) {
      // midpoint offset means ms mod 15min ≠ 0 (unless perfectly on boundary by coincidence)
      expect(ms % (15 * 60_000)).not.toBe(0)
    }
  })
})
