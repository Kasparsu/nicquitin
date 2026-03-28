/**
 * Returns 0..1+ indicating how far through the product's release duration
 * the session has progressed.  Values > 1 mean the product has run its course.
 *
 * @param {{ startTs: number }} session
 * @param {{ releaseDurationH: number }} product
 * @param {number} nowMs
 * @returns {number}
 */
export function computeSessionProgress(session, product, nowMs) {
  if (!session || !product || !product.releaseDurationH) return 0
  return (nowMs - session.startTs) / (product.releaseDurationH * 3_600_000)
}

/**
 * Returns the number of milliseconds remaining in the session, clamped to 0.
 *
 * @param {{ startTs: number }} session
 * @param {{ releaseDurationH: number }} product
 * @param {number} nowMs
 * @returns {number} ms remaining (0 if already elapsed)
 */
export function computeSessionRemainingMs(session, product, nowMs) {
  if (!session || !product || !product.releaseDurationH) return 0
  const endTs = session.startTs + product.releaseDurationH * 3_600_000
  return Math.max(0, endTs - nowMs)
}

/**
 * Estimates the mg absorbed if the session were stopped right now.
 * Accounts for partial duration (early removal) and reuse depletion.
 *
 * @param {{ startTs: number, reuseCount: number }} session
 * @param {{ nicotineMg: number, releaseDurationH: number }} product
 * @param {number} nowMs
 * @returns {number} mg
 */
export function computeSessionEstimatedDose(session, product, nowMs) {
  if (!session || !product) return 0
  const elapsedH    = (nowMs - session.startTs) / 3_600_000
  const maxH        = product.releaseDurationH || 1
  const fraction    = Math.min(1, elapsedH / maxH)
  return product.nicotineMg * fraction * Math.pow(0.5, session.reuseCount || 0)
}

/**
 * Calculates the actual nicotine mg to log when a session is stopped.
 * This is the canonical dose formula used by stopSession and reusePouch.
 *
 * @param {{ startTs: number, reuseCount: number }} session
 * @param {{ nicotineMg: number, releaseDurationH: number }} product
 * @param {number} stopTs
 * @param {{ swallowed?: boolean }} opts
 * @returns {number} mg
 */
export function computeStopSessionDose(session, product, stopTs, opts = {}) {
  const actualDurationH = (stopTs - session.startTs) / 3_600_000
  const maxH            = product.releaseDurationH || 1
  let mg = product.nicotineMg * Math.min(1, actualDurationH / maxH)
  mg    *= Math.pow(0.5, session.reuseCount || 0)
  if (opts.swallowed) mg *= 1.08
  return mg
}
