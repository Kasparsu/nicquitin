export const BASE_HL_H       = 2      // baseline nicotine half-life (hours)
export const CLEAN_THRESHOLD = 0.05   // mg — considered "nicotine free" below this

/**
 * Returns the adjusted nicotine half-life in hours based on the user's
 * metabolism profile.
 * @param {{ sex: string, metabolizer: string, menthol: boolean, pregnant: boolean, contraceptives: boolean }} profile
 * @returns {number} half-life in hours, rounded to 2 decimal places
 */
export function calcHalfLife(profile) {
  let hl = BASE_HL_H
  if (profile.sex === 'female') hl *= 0.83
  if (profile.pregnant) hl *= 0.78
  if (profile.sex === 'female' && profile.contraceptives && !profile.pregnant) hl *= 0.88
  if (profile.metabolizer === 'slow') hl *= 1.75
  if (profile.metabolizer === 'fast') hl *= 0.70
  if (profile.menthol) hl *= 1.20
  return Math.round(hl * 100) / 100
}

/**
 * Calculates the amount of nicotine (mg) remaining in the body from a single
 * log entry at a given point in time, using pharmacokinetic models:
 *   - Instant release: simple exponential decay
 *   - Slow release:    continuous infusion model with exponential decay after
 *                      the release window closes
 *
 * @param {{ ts: number, nicotineMg: number, releaseType: string, releaseDurationH: number }} entry
 * @param {number} atMs      — timestamp to evaluate at (ms since epoch)
 * @param {number} halfLifeH — nicotine half-life in hours
 * @returns {number} mg remaining
 */
export function nicotineFromEntry(entry, atMs, halfLifeH) {
  const elapsedH = (atMs - entry.ts) / 3_600_000
  if (elapsedH <= 0) return 0
  const dose   = entry.nicotineMg ?? 0
  const lambda = Math.LN2 / halfLifeH
  if (entry.releaseType !== 'slow') return dose * Math.exp(-lambda * elapsedH)
  const D = Math.max(entry.releaseDurationH || 1, 0.01)
  if (elapsedH < D) return (dose / D) * (1 - Math.exp(-lambda * elapsedH)) / lambda
  return (dose / D) * Math.exp(-lambda * (elapsedH - D)) * (1 - Math.exp(-lambda * D)) / lambda
}

/**
 * Scans forward in 15-minute steps to find when the combined nicotine level
 * from all entries drops below CLEAN_THRESHOLD.
 *
 * @param {Array} entries  — log entries + any virtual active-session entries
 * @param {number} nowMs   — current time in ms
 * @param {number} halfLifeH
 * @returns {number|null}  — ms until clean (midpoint estimate), or null if already clean
 */
export function computeTimeUntilCleanMs(entries, nowMs, halfLifeH) {
  const currentLevel = entries.reduce((s, e) => s + nicotineFromEntry(e, nowMs, halfLifeH), 0)
  if (currentLevel <= CLEAN_THRESHOLD) return null

  const STEP = 15 * 60_000
  let lastAbove = nowMs
  for (let i = 1; i <= 3 * 24 * 4; i++) {
    const t = nowMs + i * STEP
    if (entries.reduce((s, e) => s + nicotineFromEntry(e, t, halfLifeH), 0) > CLEAN_THRESHOLD) {
      lastAbove = t
    }
  }
  // Return midpoint of the uncertainty window
  return lastAbove - nowMs + STEP / 2
}
