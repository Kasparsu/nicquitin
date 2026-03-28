import { describe, it, expect } from 'vitest'
import { formatDuration, formatDateTime, relativeAgo } from '../lib/format.js'

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns "1m" for < 1 minute (rounds up)', () => {
    expect(formatDuration(30_000)).toBe('1m')
  })

  it('returns "1m" for exactly 60 seconds', () => {
    expect(formatDuration(60_000)).toBe('1m')
  })

  it('rounds up fractional minutes', () => {
    expect(formatDuration(90_000)).toBe('2m')
  })

  it('returns "30m" for 30 minutes', () => {
    expect(formatDuration(30 * 60_000)).toBe('30m')
  })

  it('returns "1h" for exactly 1 hour', () => {
    expect(formatDuration(3_600_000)).toBe('1h')
  })

  it('returns "1h 1m" for 1 hour 1 minute', () => {
    expect(formatDuration(3_660_000)).toBe('1h 1m')
  })

  it('returns "1h 30m" for 90 minutes', () => {
    expect(formatDuration(90 * 60_000)).toBe('1h 30m')
  })

  it('omits minutes when exactly on the hour', () => {
    expect(formatDuration(3 * 3_600_000)).toBe('3h')
  })

  it('returns "1d" for exactly 24 hours', () => {
    expect(formatDuration(24 * 3_600_000)).toBe('1d')
  })

  it('returns "1d 1h" for 25 hours', () => {
    expect(formatDuration(25 * 3_600_000)).toBe('1d 1h')
  })

  it('omits hours part when remainder is 0', () => {
    expect(formatDuration(48 * 3_600_000)).toBe('2d')
  })

  it('returns "3d 6h" for 78 hours', () => {
    expect(formatDuration(78 * 3_600_000)).toBe('3d 6h')
  })
})

// ─── formatDateTime ───────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  it('returns a non-empty string', () => {
    expect(formatDateTime(Date.now()).length).toBeGreaterThan(0)
  })

  it('includes time separator', () => {
    // toLocaleString with hour+minute always contains ':'
    expect(formatDateTime(Date.now())).toMatch(/:/)
  })

  it('produces different strings for different timestamps', () => {
    const a = formatDateTime(1_000_000_000_000)
    const b = formatDateTime(1_100_000_000_000)
    expect(a).not.toBe(b)
  })
})

// ─── relativeAgo ─────────────────────────────────────────────────────────────

describe('relativeAgo', () => {
  const now = 1_700_000_000_000

  it('shows minutes when diff < 1 hour', () => {
    expect(relativeAgo(now - 23 * 60_000, now)).toBe('23m ago')
  })

  it('shows "0m ago" for diff = 0', () => {
    expect(relativeAgo(now, now)).toBe('0m ago')
  })

  it('shows "1h ago" for exactly 1 hour', () => {
    expect(relativeAgo(now - 3_600_000, now)).toBe('1h ago')
  })

  it('rounds hours correctly (2.5h → 3h ago)', () => {
    expect(relativeAgo(now - 2.5 * 3_600_000, now)).toBe('3h ago')
  })

  it('shows "1d ago" for exactly 24 hours', () => {
    expect(relativeAgo(now - 86_400_000, now)).toBe('1d ago')
  })

  it('shows "3d ago" for 72 hours', () => {
    expect(relativeAgo(now - 3 * 86_400_000, now)).toBe('3d ago')
  })
})
