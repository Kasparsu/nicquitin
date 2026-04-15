<template>
  <div class="flex flex-col" style="height: calc(100dvh - 10rem);">
    <!-- Header -->
    <div class="flex justify-between items-center mb-2">
      <h2 class="text-base font-bold">history</h2>
      <button v-if="allEntries.length" class="btn btn-ghost btn-xs text-error" @click="confirmClearAll">clear all</button>
    </div>

    <!-- Scrollable list -->
    <div class="flex-1 overflow-y-auto space-y-3 min-h-0">
      <template v-if="!pagedGroups.length">
        <div class="text-center text-base-content/40 text-sm py-8">no history yet</div>
      </template>

      <div v-for="group in pagedGroups" :key="group.label">
        <div class="text-xs font-semibold text-base-content/40 uppercase tracking-wide sticky top-0 bg-base-200 py-1 z-10">
          {{ group.label }}
        </div>
        <ul class="space-y-1 mt-1">
          <li v-for="item in group.items" :key="item.key">

            <!-- Editing a usage entry -->
            <div v-if="editing?.key === item.key && item.type === 'usage'" class="bg-base-200 rounded-xl px-3 py-3 space-y-2">
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">product</span></div>
                <select class="select select-sm select-bordered" v-model="editing.productId" @change="onProductChange">
                  <option v-for="p in availableProducts" :key="p.id" :value="p.id">{{ p.emoji }} {{ p.name }}</option>
                  <option v-if="!availableProducts.some(p => p.id === editing.productId)" :value="editing.productId">{{ editing.emoji }} {{ editing.productName }} (removed)</option>
                </select>
              </label>
              <div class="grid grid-cols-2 gap-2">
                <label class="form-control">
                  <div class="label py-0.5"><span class="label-text text-xs">time</span></div>
                  <input type="datetime-local" class="input input-sm input-bordered font-mono text-xs" v-model="editing.datetime" />
                </label>
                <label class="form-control">
                  <div class="label py-0.5"><span class="label-text text-xs">nicotine (mg)</span></div>
                  <input type="number" class="input input-sm input-bordered font-mono" min="0" step="0.01" v-model.number="editing.nicotineMg" />
                </label>
              </div>
              <label v-if="item.entry.puffs != null" class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">puffs</span></div>
                <input type="number" class="input input-sm input-bordered font-mono" min="1" step="1" v-model.number="editing.puffs" />
              </label>
              <label v-if="item.entry.stoppedTs" class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">stopped</span></div>
                <input type="datetime-local" class="input input-sm input-bordered font-mono text-xs" v-model="editing.stoppedDatetime" />
              </label>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-xs flex-1" @click="saveEdit">save</button>
                <button class="btn btn-ghost btn-xs" @click="editing = null">cancel</button>
              </div>
            </div>

            <!-- Usage entry display -->
            <div v-else-if="item.type === 'usage'" class="flex items-center justify-between text-sm gap-2">
              <div class="flex items-center gap-2 min-w-0 cursor-pointer" @click="startEdit(item)">
                <span class="shrink-0">{{ item.entry.emoji }}</span>
                <div class="truncate">
                  <span class="font-medium">{{ item.entry.product }}</span>
                  <span v-if="item.entry.puffs" class="text-base-content/50 text-xs ml-1">{{ item.entry.puffs }} puffs</span>
                  <span v-if="item.entry.stoppedTs" class="text-base-content/40 text-xs ml-1">{{ formatDuration(item.entry.stoppedTs - item.entry.ts) }}</span>
                  <span v-if="item.entry.nicotineMg != null" class="text-base-content/40 text-xs ml-1">({{ item.entry.nicotineMg.toFixed(2) }}mg)</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-base-content/40 text-xs">{{ formatTime(item.ts) }}</span>
                <button class="btn btn-ghost btn-xs text-error p-0 min-h-0 h-auto leading-none" @click="confirmRemove(item.entry)">✕</button>
              </div>
            </div>

            <!-- Challenge entry display -->
            <div v-else class="flex items-center justify-between text-sm gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="shrink-0 text-success">✓</span>
                <div class="truncate">
                  <span class="font-medium text-success/80">resisted</span>
                  <span class="text-base-content/50 text-xs ml-1">{{ item.entry.text }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-base-content/40 text-xs">{{ formatTime(item.ts) }}</span>
                <button class="btn btn-ghost btn-xs text-error p-0 min-h-0 h-auto leading-none" @click="challengesStore.removeChallenge(item.entry.ts)">✕</button>
              </div>
            </div>

          </li>
        </ul>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-between items-center pt-2 shrink-0">
      <button class="btn btn-ghost btn-xs" :disabled="page <= 0" @click="page--">← newer</button>
      <span class="text-xs text-base-content/40">{{ page + 1 }} / {{ totalPages }}</span>
      <button class="btn btn-ghost btn-xs" :disabled="page >= totalPages - 1" @click="page++">older →</button>
    </div>
    <ConfirmModal ref="confirmModal" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { formatDuration } from '../lib/format.js'
import ConfirmModal from './ConfirmModal.vue'
import { useLogStore } from '../stores/log.js'
import { useProductsStore } from '../stores/products.js'
import { useChallengesStore } from '../stores/challenges.js'

const logStore = useLogStore()
const productsStore = useProductsStore()
const challengesStore = useChallengesStore()
const { log } = storeToRefs(logStore)

const page = ref(0)
const editing = ref(null)

// Merge usage log + challenges into one sorted timeline
const allEntries = computed(() => {
  const usages = log.value.map(e => ({
    type: 'usage',
    ts: e.stoppedTs || e.ts,
    key: `u-${e.id}`,
    entry: e,
  }))
  const challenges = challengesStore.log.map(c => ({
    type: 'challenge',
    ts: c.ts,
    key: `c-${c.ts}`,
    entry: c,
  }))
  return [...usages, ...challenges].sort((a, b) => b.ts - a.ts)
})

// Group by time period — adapt grouping to data density
function groupLabel(ts) {
  const now = new Date()
  const d = new Date(ts)
  const diffDays = Math.floor((now - d) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined })
}

const grouped = computed(() => {
  const groups = []
  let current = null
  for (const item of allEntries.value) {
    const label = groupLabel(item.ts)
    if (!current || current.label !== label) {
      current = { label, items: [] }
      groups.push(current)
    }
    current.items.push(item)
  }
  return groups
})

// Pagination: ~15 items per page, but keep groups whole
const PAGE_SIZE = 15

const totalPages = computed(() => {
  if (!allEntries.value.length) return 1
  return Math.ceil(allEntries.value.length / PAGE_SIZE)
})

const pagedGroups = computed(() => {
  const start = page.value * PAGE_SIZE
  const end = start + PAGE_SIZE
  const sliced = allEntries.value.slice(start, end)

  const groups = []
  let current = null
  for (const item of sliced) {
    const label = groupLabel(item.ts)
    if (!current || current.label !== label) {
      current = { label, items: [] }
      groups.push(current)
    }
    current.items.push(item)
  }
  return groups
})

// ─── Time formatting ──────────────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// ─── Editing ──────────────────────────────────────────────────────────────────

function toLocalDatetime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const availableProducts = computed(() => productsStore.products)

function startEdit(item) {
  const e = item.entry
  editing.value = {
    key: item.key,
    id: e.id,
    productId: e.productId,
    productName: e.product,
    emoji: e.emoji,
    datetime: toLocalDatetime(e.ts),
    stoppedDatetime: e.stoppedTs ? toLocalDatetime(e.stoppedTs) : null,
    nicotineMg: e.nicotineMg,
    puffs: e.puffs,
  }
}

function onProductChange() {
  const p = productsStore.productById(editing.value.productId)
  if (!p) return
  editing.value.productName = p.name
  editing.value.emoji = p.emoji
  editing.value.nicotineMg = p.nicotineMg
}

function saveEdit() {
  if (!editing.value) return
  const p = productsStore.productById(editing.value.productId)
  const fields = {
    ts: new Date(editing.value.datetime).getTime(),
    nicotineMg: editing.value.nicotineMg,
    productId: editing.value.productId,
    product: p ? p.name : editing.value.productName,
    emoji: p ? p.emoji : editing.value.emoji,
  }
  if (p) {
    fields.releaseType = p.releaseType
    fields.releaseDurationH = p.releaseDurationH
    fields.producesCO = p.producesCO ?? false
    fields.isNRT = p.isNRT ?? false
  }
  if (editing.value.puffs != null) fields.puffs = editing.value.puffs
  if (editing.value.stoppedDatetime) fields.stoppedTs = new Date(editing.value.stoppedDatetime).getTime()
  logStore.updateEntry(editing.value.id, fields)
  editing.value = null
}

const confirmModal = ref(null)

async function confirmClearAll() {
  const ok = await confirmModal.value.show({
    title: 'Clear all history?',
    message: 'This will permanently delete all logged entries. This cannot be undone.',
    confirmLabel: 'clear all',
  })
  if (ok) { logStore.clearAll(); page.value = 0 }
}

async function confirmRemove(entry) {
  const ok = await confirmModal.value.show({
    title: 'Delete entry?',
    message: `Remove ${entry.emoji} ${entry.product} from history?`,
    confirmLabel: 'delete',
  })
  if (ok) logStore.removeEntry(entry.id)
}
</script>
