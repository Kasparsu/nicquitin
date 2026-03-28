const MIN_INTERVAL_MS = 5 * 60_000   // ignore gaps < 5 min (rapid re-logs)
const RECENT_WINDOW   = 20            // use last N intervals for avg
const TREND_WINDOW    = 7             // entries per half for trend comparison

/**
 * Computes consecutive inter-use intervals from a log, filtered to >= 5 min.
 * For session-based entries (patch/gum/pouch), the interval is measured from
 * the *end* of the previous session (stoppedTs) to the start of the next.
 *
 * @param {Array<{ ts: number, stoppedTs?: number }>} logEntries — any order, sorted internally
 * @returns {number[]} intervals in ms
 */
export function computeIntervals(logEntries) {
  const sorted = [...logEntries].sort((a, b) => a.ts - b.ts)
  const result = []
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].stoppedTs || sorted[i - 1].ts
    const diff    = sorted[i].ts - prevEnd
    if (diff >= MIN_INTERVAL_MS) result.push(diff)
  }
  return result
}

/**
 * Average of the last RECENT_WINDOW intervals.
 * Returns 0 if there are no intervals.
 *
 * @param {number[]} intervals — output of computeIntervals
 * @returns {number} ms
 */
export function computeAvgInterval(intervals) {
  const recent = intervals.slice(-RECENT_WINDOW)
  if (!recent.length) return 0
  return recent.reduce((s, v) => s + v, 0) / recent.length
}

/**
 * Uses-per-day in the trailing 7-day window.
 *
 * @param {Array<{ ts: number }>} logEntries
 * @param {number} nowMs
 * @returns {number}
 */
export function computeUsesPerDay7d(logEntries, nowMs) {
  const cutoff = nowMs - 7 * 86_400_000
  return logEntries.filter(e => e.ts >= cutoff).length / 7
}

/**
 * Compares the average of the most recent TREND_WINDOW intervals with the
 * preceding TREND_WINDOW to determine if usage is improving / worsening.
 *
 * @param {number[]} intervals — output of computeIntervals
 * @returns {'improving'|'worsening'|'stable'|'neutral'}
 */
export function computeTrend(intervals) {
  const recent = intervals.slice(-TREND_WINDOW)
  const prev   = intervals.slice(-(TREND_WINDOW * 2), -TREND_WINDOW)
  if (recent.length < 3 || prev.length < 3) return 'neutral'
  const rAvg = recent.reduce((s, v) => s + v, 0) / recent.length
  const pAvg = prev.reduce((s, v) => s + v, 0) / prev.length
  if (rAvg > pAvg * 1.1) return 'improving'
  if (rAvg < pAvg * 0.9) return 'worsening'
  return 'stable'
}
