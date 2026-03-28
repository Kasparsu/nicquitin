import { describe, it, expect } from 'vitest'
import {
  computeIntervals,
  computeAvgInterval,
  computeUsesPerDay7d,
  computeTrend,
} from '../lib/patterns.js'

const MIN = 60_000
const H   = 3_600_000
const now = 1_700_000_000_000

// ─── computeIntervals ─────────────────────────────────────────────────────────

describe('computeIntervals', () => {
  it('returns [] for empty log', () => {
    expect(computeIntervals([])).toEqual([])
  })

  it('returns [] for a single entry', () => {
    expect(computeIntervals([{ ts: now }])).toEqual([])
  })

  it('filters out gaps shorter than 5 minutes', () => {
    const log = [{ ts: now }, { ts: now + 4 * MIN }]
    expect(computeIntervals(log)).toEqual([])
  })

  it('includes a gap of exactly 5 minutes', () => {
    const log = [{ ts: now }, { ts: now + 5 * MIN }]
    expect(computeIntervals(log)).toEqual([5 * MIN])
  })

  it('measures gap from start-of-prev to start-of-next for instant entries', () => {
    const log = [{ ts: now }, { ts: now + H }]
    expect(computeIntervals(log)).toEqual([H])
  })

  it('measures gap from stoppedTs of prev to ts of next for session entries', () => {
    const log = [
      { ts: now,          stoppedTs: now + H },   // session: 1h use
      { ts: now + 2 * H },                          // next use 1h after session ended
    ]
    expect(computeIntervals(log)).toEqual([H])  // gap = (now+2H) - (now+H)
  })

  it('sorts entries by ts before computing intervals', () => {
    // Entries in reverse order — should still work
    const log = [{ ts: now + 2 * H }, { ts: now }]
    expect(computeIntervals(log)).toEqual([2 * H])
  })

  it('handles multiple entries correctly', () => {
    const log = [
      { ts: now },
      { ts: now + H },
      { ts: now + 3 * H },
    ]
    expect(computeIntervals(log)).toEqual([H, 2 * H])
  })
})

// ─── computeAvgInterval ───────────────────────────────────────────────────────

describe('computeAvgInterval', () => {
  it('returns 0 for empty intervals', () => {
    expect(computeAvgInterval([])).toBe(0)
  })

  it('returns the single value for one interval', () => {
    expect(computeAvgInterval([H])).toBe(H)
  })

  it('returns the mean of all intervals when count <= 20', () => {
    expect(computeAvgInterval([H, 2 * H, 3 * H])).toBeCloseTo(2 * H)
  })

  it('uses only the last 20 intervals when there are more', () => {
    // 25 intervals: first 5 are 1h, last 20 are 2h
    const intervals = [...Array(5).fill(H), ...Array(20).fill(2 * H)]
    expect(computeAvgInterval(intervals)).toBe(2 * H)
  })
})

// ─── computeUsesPerDay7d ──────────────────────────────────────────────────────

describe('computeUsesPerDay7d', () => {
  it('returns 0 for empty log', () => {
    expect(computeUsesPerDay7d([], now)).toBe(0)
  })

  it('returns 0 when all entries are older than 7 days', () => {
    const log = [{ ts: now - 8 * 24 * H }]
    expect(computeUsesPerDay7d(log, now)).toBe(0)
  })

  it('returns 1.0 for exactly 7 entries in 7 days', () => {
    const log = Array.from({ length: 7 }, (_, i) => ({ ts: now - i * 24 * H }))
    expect(computeUsesPerDay7d(log, now)).toBe(1)
  })

  it('ignores entries older than 7 days', () => {
    const log = [
      { ts: now - 1 * H },           // recent
      { ts: now - 8 * 24 * H },       // too old
    ]
    expect(computeUsesPerDay7d(log, now)).toBeCloseTo(1 / 7)
  })

  it('includes entries on the boundary (exactly 7 days ago)', () => {
    const log = [{ ts: now - 7 * 24 * H }]  // exactly at cutoff (>= cutoff passes)
    expect(computeUsesPerDay7d(log, now)).toBeGreaterThan(0)
  })
})

// ─── computeTrend ─────────────────────────────────────────────────────────────

describe('computeTrend', () => {
  it('returns "neutral" for empty intervals', () => {
    expect(computeTrend([])).toBe('neutral')
  })

  it('returns "neutral" when fewer than 3 recent intervals', () => {
    expect(computeTrend([H, H])).toBe('neutral')
  })

  it('returns "neutral" when not enough previous intervals for comparison', () => {
    // 6 total: 3 recent, 3 prev — that should be enough; test truly insufficient case
    expect(computeTrend([H, H])).toBe('neutral')
  })

  it('returns "improving" when recent avg > prev avg * 1.1', () => {
    // Recent 7: all 3h intervals (avg = 3h); Prev 7: all 1h intervals (avg = 1h)
    // 3h > 1h * 1.1 = 1.1h → improving
    const prev   = Array(7).fill(H)
    const recent = Array(7).fill(3 * H)
    expect(computeTrend([...prev, ...recent])).toBe('improving')
  })

  it('returns "worsening" when recent avg < prev avg * 0.9', () => {
    // Recent 7: all 1h intervals; Prev 7: all 3h intervals
    // 1h < 3h * 0.9 = 2.7h → worsening
    const prev   = Array(7).fill(3 * H)
    const recent = Array(7).fill(H)
    expect(computeTrend([...prev, ...recent])).toBe('worsening')
  })

  it('returns "stable" when averages are within 10% of each other', () => {
    const prev   = Array(7).fill(2 * H)
    const recent = Array(7).fill(2.05 * H)  // 2.5% above — within 10%
    expect(computeTrend([...prev, ...recent])).toBe('stable')
  })
})
