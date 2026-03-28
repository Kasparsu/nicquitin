/**
 * Formats a duration in milliseconds into a human-readable string.
 * Uses ceiling for sub-hour values so "30 seconds remaining" shows "1m".
 *
 * @param {number} ms
 * @returns {string} e.g. "3h 45m", "2d", "12m"
 */
export function formatDuration(ms) {
  const totalMin = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 24) {
    const d  = Math.floor(h / 24)
    const rh = h % 24
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`
  }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${totalMin}m`
}

/**
 * Formats a Unix timestamp (ms) to a short locale date+time string.
 * @param {number} ts
 * @returns {string}
 */
export function formatDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Returns a relative time string like "23m ago", "2h ago", "3d ago".
 * @param {number} ts    — timestamp of the event (ms)
 * @param {number} nowMs — current time (ms); explicit for purity / testability
 * @returns {string}
 */
export function relativeAgo(ts, nowMs) {
  const diff = nowMs - ts
  if (diff < 3_600_000)  return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}
