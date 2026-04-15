import { pickSuggestion } from './suggestions.js'

let scheduledTimer = null

export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied')
  if (Notification.permission === 'granted') return Promise.resolve('granted')
  return Notification.requestPermission()
}

export function scheduleNextUsageNotification(predictedTs, leadTimeMs = 5 * 60 * 1000) {
  clearScheduled()
  const fireAt = predictedTs - leadTimeMs
  const delay = fireAt - Date.now()
  if (delay <= 0) return

  scheduledTimer = setTimeout(() => {
    if (Notification.permission !== 'granted') return
    const s = pickSuggestion()
    new Notification('Craving incoming?', {
      body: `${s.category.emoji} Try this instead: ${s.text}`,
      tag: 'niczero-craving',
      renotify: true,
    })
  }, delay)
}

export function clearScheduled() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }
}
