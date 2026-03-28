import { beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Provide a full localStorage mock (jsdom's implementation varies by version)
const store = {}
global.localStorage = {
  getItem:    (k)    => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
  setItem:    (k, v) => { store[k] = String(v) },
  removeItem: (k)    => { delete store[k] },
  clear:      ()     => { for (const k in store) delete store[k] },
  key:        (i)    => Object.keys(store)[i] ?? null,
  get length ()      { return Object.keys(store).length },
}

// Reset between every test
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

// Stub browser APIs that aren't available in jsdom
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Synchronous FileReader mock so FileReader.onload fires before flushPromises()
global.FileReader = class {
  readAsText(file) {
    // Read the file synchronously using its text() method isn't available, so
    // we extract the content from the Blob via _store (set by File constructor shim)
    // or via the file's underlying data.  The simplest approach: schedule microtask.
    const reader = this
    file.text().then((text) => {
      if (reader.onload) reader.onload({ target: { result: text } })
    })
  }
}
