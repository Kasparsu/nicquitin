export const BEAT_STEP          = 0.08   // multiplier increment per successful beat
export const INITIAL_MULTIPLIER = 1.15   // starting target = 15% above average
export const BEAT_MULTIPLIER_CAP = 8     // cap: 8× avg ≈ a day or more

/**
 * Returns the success rate of recent beat attempts (last 10), or null if
 * there is not yet enough data (< 3 attempts).
 * @param {boolean[]} outcomes — array of true (beat) / false (failed)
 * @returns {number|null} 0..1, or null
 */
export function computeRecentSuccessRate(outcomes) {
  if (!outcomes || outcomes.length < 3) return null
  return outcomes.filter(Boolean).length / outcomes.length
}

/**
 * Pure function: given a completed interval and the current progress state,
 * returns the *new* progress state.  Does not mutate the input.
 *
 * Beat logic:
 *   - success (interval >= target): increment totalBeats / streak / bestStreak,
 *     increase multiplier by BEAT_STEP plus a small hot-streak bonus.
 *   - failure (interval < target): reset currentStreak; if recent success rate
 *     is below 40% (with >= 3 data points), ease the multiplier back down,
 *     floored at INITIAL_MULTIPLIER.
 *
 * @param {number} intervalMs    — the gap just measured (ms)
 * @param {number} avgIntervalMs — current rolling average interval (ms)
 * @param {{ multiplier: number, totalBeats: number, totalAttempts: number,
 *           currentStreak: number, bestStreak: number, bestIntervalMs: number,
 *           recentOutcomes: boolean[] }} state
 * @returns {typeof state} new state object
 */
export function applyBeatResult(intervalMs, avgIntervalMs, state) {
  const target  = avgIntervalMs * state.multiplier
  const success = intervalMs >= target

  const outcomes    = [...(state.recentOutcomes || []), success].slice(-10)
  const recentRate  = computeRecentSuccessRate(outcomes)
  const next        = { ...state, recentOutcomes: outcomes, totalAttempts: (state.totalAttempts || 0) + 1 }

  if (success) {
    next.totalBeats      = (next.totalBeats || 0) + 1
    next.currentStreak   = (state.currentStreak || 0) + 1
    next.bestStreak      = Math.max(state.bestStreak || 0, next.currentStreak)
    next.bestIntervalMs  = Math.max(state.bestIntervalMs || 0, intervalMs)
    // Hot-streak bonus: each consecutive beat adds a tiny extra push (capped at +0.025)
    const streakBonus    = Math.min(next.currentStreak * 0.005, 0.025)
    next.multiplier      = Math.min(
      parseFloat((state.multiplier + BEAT_STEP + streakBonus).toFixed(4)),
      BEAT_MULTIPLIER_CAP,
    )
  } else {
    next.currentStreak = 0
    // Ease back when struggling (recent rate < 40%, needs >= 3 data points)
    if (recentRate !== null && recentRate < 0.4) {
      const reduction  = BEAT_STEP * (0.4 - recentRate) / 0.4
      next.multiplier  = Math.max(
        parseFloat((state.multiplier - reduction).toFixed(4)),
        INITIAL_MULTIPLIER,
      )
    }
  }
  return next
}
