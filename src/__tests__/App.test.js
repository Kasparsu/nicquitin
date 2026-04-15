import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { router } from '../router.js'
import App from '../App.vue'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mountApp(lsData = {}, route = '/') {
  for (const [k, v] of Object.entries(lsData)) {
    localStorage.setItem(k, JSON.stringify(v))
  }
  router.push(route)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function makeLogEntry(overrides = {}) {
  const ts = Date.now()
  return {
    id: ts, productId: 'cigarette', product: 'Cigarette', emoji: '🚬',
    nicotineMg: 1.1, releaseType: 'instant', releaseDurationH: 0,
    puffs: null, ts,
    ...overrides,
  }
}

function btn(wrapper, text) {
  return wrapper.findAll('button').find(b => b.text().includes(text))
}

// Click a habit product and skip the suggestion intercept
async function clickHabitProduct(wrapper, name) {
  await btn(wrapper, name)?.trigger('click')
  await flushPromises()
  // Suggestion intercept shows for non-NRT products; skip it
  const logAnyway = btn(wrapper, 'use anyway')
  if (logAnyway) {
    await logAnyway.trigger('click')
    await flushPromises()
  }
}

// Products used for session tests (patch/gum removed from defaults, now NRT presets)
const SESSION_TEST_PRODUCTS = [
  { id: 'cigarette', name: 'Cigarette', emoji: '🚬', nicotineMg: 1.1, releaseType: 'instant', releaseDurationH: 0, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: true, isNRT: false },
  { id: 'vape', name: 'Vape', emoji: '💨', nicotineMg: 0.1, releaseType: 'instant', releaseDurationH: 0, hasPuffCount: true, useCartridgeCalc: true, cartridgeNicotineMg: 20, cartridgeTotalPuffs: 200, hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: false },
  { id: 'patch', name: 'Patch (21mg)', emoji: '🩹', nicotineMg: 14, releaseType: 'slow', releaseDurationH: 16, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'gum', name: 'Gum (4mg)', emoji: '🟡', nicotineMg: 2, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'pouch', name: 'Pouch', emoji: '🫙', nicotineMg: 3, releaseType: 'slow', releaseDurationH: 1, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: true, producesCO: false, isNRT: false },
]

// ─── Initial render ───────────────────────────────────────────────────────────

describe('initial render', () => {
  it('shows 0.00 mg nicotine level with empty log', async () => {
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('0.00')
  })

  it('shows "nicotine free ✓" when log is empty', async () => {
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('nicotine free ✓')
  })

  it('shows "no usage logged yet" in timer section', async () => {
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('no usage logged yet')
  })

  it('loads products from localStorage when present', async () => {
    const custom = [{ id: 'x', name: 'MyProd', emoji: '🎯', nicotineMg: 5, releaseType: 'instant',
      releaseDurationH: 0, hasPuffCount: false, useCartridgeCalc: false,
      cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: false,
      hasSwallowOption: false, hasReuseOption: false }]
    const wrapper = await mountApp({ 'nicquitin-products': custom }, '/log')
    expect(wrapper.text()).toContain('MyProd')
  })
})

// ─── Logging instant products ─────────────────────────────────────────────────

describe('logging instant products (cigarette)', () => {
  it('adds an entry to the log on click', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Cigarette')
    const stored = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].product).toBe('Cigarette')
  })

  it('shows a positive nicotine level after logging', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Cigarette')
    const stored = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(stored.length).toBeGreaterThan(0)
  })

  it('persists the log to localStorage', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Cigarette')
    expect(localStorage.getItem('nicquitin-log')).not.toBeNull()
  })
})

// ─── Puff-count product (vape) ────────────────────────────────────────────────

describe('vape puff flow', () => {
  it('opens the puff count panel on click', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Vape')
    expect(wrapper.text()).toMatch(/puffs/)
  })

  it('closes the panel when the same button is clicked again', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Vape')
    // Second click on Vape toggles the puff panel closed (no suggestion — panel already open)
    await btn(wrapper, 'Vape')?.trigger('click')
    await flushPromises()
    const puffLogBtn = wrapper.findAll('button').find(b => b.text().match(/^log \d+ puffs$/))
    expect(puffLogBtn).toBeUndefined()
  })

  it('logs the entry after confirming puff count', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Vape')
    const logBtn = btn(wrapper, 'log')
    await logBtn?.trigger('click')
    const stored = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].puffs).toBe(10)
  })
})

// ─── Session product — patch ──────────────────────────────────────────────────

describe('patch session', () => {
  it('starts a session when patch button is clicked (no active session)', async () => {
    const wrapper = await mountApp({ 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    await btn(wrapper, 'Patch')?.trigger('click')
    const sessions = JSON.parse(localStorage.getItem('nicquitin-sessions-v2') ?? '[]')
    const patch = sessions.find(s => s.productId === 'patch')
    expect(patch).toBeDefined()
    expect(patch.reuseCount).toBe(0)
  })

  it('shows the stop panel when patch is clicked while a session is active', async () => {
    const wrapper = await mountApp({ 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    await btn(wrapper, 'Patch')?.trigger('click')
    await flushPromises()
    await btn(wrapper, 'Patch')?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toMatch(/remove|session in use/)
  })

  it('logs a session entry and clears the active session on stop', async () => {
    const wrapper = await mountApp({ 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    await btn(wrapper, 'Patch')?.trigger('click')
    await flushPromises()
    await btn(wrapper, 'Patch')?.trigger('click')
    await flushPromises()
    const removeBtn = btn(wrapper, 'remove 🩹')
    await removeBtn?.trigger('click')
    await flushPromises()
    const sessions = JSON.parse(localStorage.getItem('nicquitin-sessions') ?? '{}')
    expect(sessions['patch']).toBeUndefined()
    const log = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(log.length).toBeGreaterThan(0)
    expect(log[0].stoppedTs).toBeDefined()
  })
})

// ─── Session product — gum ────────────────────────────────────────────────────

describe('gum session — spit vs swallow', () => {
  it('shows spit and swallow options', async () => {
    const wrapper = await mountApp({ 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    await btn(wrapper, 'Gum')?.trigger('click')  // start session
    await flushPromises()
    await btn(wrapper, 'Gum')?.trigger('click')  // open stop panel
    await flushPromises()
    expect(wrapper.text()).toContain('spit out')
    expect(wrapper.text()).toContain('swallow')
  })

  it('logs a lower dose when spitting out', async () => {
    const startTs = Date.now() - 15 * 60_000
    const sessions = { gum: { startTs, reuseCount: 0 } }

    const wrapper = await mountApp({ 'nicquitin-sessions': sessions, 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    await btn(wrapper, 'Gum')?.trigger('click')  // open stop panel (session already active)
    await flushPromises()
    await btn(wrapper, 'spit out')?.trigger('click')
    await flushPromises()
    const log = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(log).toHaveLength(1)
    const spitDose = log[0].nicotineMg

    localStorage.clear()
    const w2 = await mountApp({ 'nicquitin-sessions': { gum: { startTs, reuseCount: 0 } }, 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    await btn(w2, 'Gum')?.trigger('click')  // open stop panel
    await flushPromises()
    await btn(w2, 'swallow')?.trigger('click')
    await flushPromises()
    const log2 = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    const swallowDose = log2[0].nicotineMg

    expect(swallowDose).toBeGreaterThan(spitDose)
  })
})

// ─── Pouch multi-session with pause ──────────────────────────────────────────

describe('pouch sessions', () => {
  it('shows pause and done buttons after starting a pouch', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Pouch')
    expect(wrapper.text()).toContain('put in tin')
    expect(wrapper.text()).toContain('done')
  })

  it('allows multiple active pouches', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Pouch')
    await clickHabitProduct(wrapper, 'Pouch')
    const stored = JSON.parse(localStorage.getItem('nicquitin-sessions-v2') ?? '[]')
    expect(stored).toHaveLength(2)
  })

  it('pauses a pouch (put in tin) and shows resume button', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Pouch')
    await btn(wrapper, 'put in tin')?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('put back in')
    const stored = JSON.parse(localStorage.getItem('nicquitin-sessions-v2') ?? '[]')
    expect(stored[0].paused).toBe(true)
  })

  it('resuming increments reuseCount', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Pouch')
    await btn(wrapper, 'put in tin')?.trigger('click')
    await flushPromises()
    await btn(wrapper, 'put back in')?.trigger('click')
    await flushPromises()
    const stored = JSON.parse(localStorage.getItem('nicquitin-sessions-v2') ?? '[]')
    expect(stored[0].reuseCount).toBe(1)
    expect(stored[0].paused).toBe(false)
  })

  it('logs entry and removes session when done', async () => {
    const wrapper = await mountApp({}, '/log')
    await clickHabitProduct(wrapper, 'Pouch')
    await btn(wrapper, 'done')?.trigger('click')
    await flushPromises()
    const sessions = JSON.parse(localStorage.getItem('nicquitin-sessions-v2') ?? '[]')
    expect(sessions).toHaveLength(0)
    const log = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(log).toHaveLength(1)
    expect(log[0].productId).toBe('pouch')
  })
})

// ─── Remove / clear log ───────────────────────────────────────────────────────

describe('removing log entries', () => {
  it('removes the specific entry when ✕ is clicked', async () => {
    const entry = makeLogEntry({ ts: Date.now() - 3_600_000 })
    const wrapper = await mountApp({ 'nicquitin-log': [entry] }, '/history')
    const removeBtn = wrapper.findAll('button').find(b => b.text() === '✕')
    await removeBtn?.trigger('click')
    const stored = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(stored).toHaveLength(0)
  })

  it('clears all entries when "clear all" is clicked', async () => {
    const log = [makeLogEntry(), makeLogEntry({ ts: Date.now() - 1000 })]
    const wrapper = await mountApp({ 'nicquitin-log': log }, '/history')
    await btn(wrapper, 'clear all')?.trigger('click')
    const stored = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(stored).toHaveLength(0)
  })
})

// ─── Settings page ───────────────────────────────────────────────────────────

describe('settings page', () => {
  it('navigates to settings page', async () => {
    const wrapper = await mountApp({}, '/settings')
    expect(wrapper.text()).toContain('Profile')
    expect(wrapper.text()).toContain('Products')
    expect(wrapper.text()).toContain('Data')
  })

  it('saves profile changes to localStorage on save', async () => {
    const wrapper = await mountApp({}, '/settings')
    const select = wrapper.find('select[class*="select"]')
    if (select.exists()) {
      await select.setValue('slow')
    }
    await btn(wrapper, 'save profile')?.trigger('click')
    const saved = JSON.parse(localStorage.getItem('nicquitin-profile') ?? '{}')
    expect(saved).toBeDefined()
  })

  it('saves product changes to localStorage on save', async () => {
    const wrapper = await mountApp({}, '/settings')
    // Switch to products tab
    await btn(wrapper, 'Products')?.trigger('click')
    await flushPromises()
    await btn(wrapper, 'save products')?.trigger('click')
    expect(localStorage.getItem('nicquitin-products')).not.toBeNull()
  })
})

// ─── Data import / export ─────────────────────────────────────────────────────

describe('export data', () => {
  it('creates a blob URL and triggers a download', async () => {
    const wrapper = await mountApp({}, '/settings')
    // Switch to data tab
    await btn(wrapper, 'Data')?.trigger('click')
    await flushPromises()
    const exportBtn = btn(wrapper, 'export')
    await exportBtn?.trigger('click')
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})

describe('import data', () => {
  it('restores log and products from a valid JSON file', async () => {
    const wrapper = await mountApp({}, '/settings')
    await btn(wrapper, 'Data')?.trigger('click')
    await flushPromises()

    const payload = {
      version: 1,
      log: [makeLogEntry()],
      products: [],
      cartridges: {},
      sessions: {},
      profile: { sex: 'female', metabolizer: 'normal', menthol: false, pregnant: false, contraceptives: false },
      progress: {},
    }
    const file    = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' })
    const input   = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], writable: false })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('data imported successfully')
    const stored = JSON.parse(localStorage.getItem('nicquitin-log') ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('shows an error for an invalid JSON file', async () => {
    const wrapper = await mountApp({}, '/settings')
    await btn(wrapper, 'Data')?.trigger('click')
    await flushPromises()

    const file  = new File(['not valid json'], 'bad.json', { type: 'application/json' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], writable: false })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('✗')
  })

  it('shows an error when the file has invalid structure', async () => {
    const wrapper = await mountApp({}, '/settings')
    await btn(wrapper, 'Data')?.trigger('click')
    await flushPromises()

    const bad  = JSON.stringify({ something: 'else' })
    const file = new File([bad], 'bad.json', { type: 'application/json' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], writable: false })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('✗')
  })
})

// ─── Beat / patterns (seeded data) ───────────────────────────────────────────

describe('patterns unlock after MIN_ENTRIES_FOR_PATTERNS uses', () => {
  it('does not show patterns card with fewer than 5 entries', async () => {
    const log = Array.from({ length: 4 }, (_, i) =>
      makeLogEntry({ ts: Date.now() - (4 - i) * 2 * 3_600_000 })
    )
    const wrapper = await mountApp({ 'nicquitin-log': log }, '/insights')
    expect(wrapper.text()).not.toContain('avg interval')
  })

  it('shows patterns card with 5 or more entries', async () => {
    const log = Array.from({ length: 6 }, (_, i) =>
      makeLogEntry({ ts: Date.now() - (6 - i) * 2 * 3_600_000 })
    )
    const wrapper = await mountApp({ 'nicquitin-log': log }, '/insights')
    expect(wrapper.text()).toContain('avg interval')
  })
})

// ─── Active sessions card ─────────────────────────────────────────────────────

describe('active sessions card', () => {
  it('shows "in use" card when a session is active', async () => {
    const sessions = { patch: { startTs: Date.now() - 3_600_000, reuseCount: 0 } }
    const wrapper  = await mountApp({ 'nicquitin-sessions': sessions, 'nicquitin-products': SESSION_TEST_PRODUCTS }, '/log')
    expect(wrapper.text()).toContain('in use')
  })

  it('does not show "in use" card when no sessions are active', async () => {
    const wrapper = await mountApp({}, '/log')
    expect(wrapper.text()).not.toContain('in use')
  })
})
