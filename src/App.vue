<template>
  <div class="min-h-screen bg-base-200 p-4 pb-10">
    <div class="max-w-xl mx-auto space-y-4">

      <!-- Header -->
      <div class="flex justify-between items-center pt-4 pb-2">
        <div>
          <h1 class="text-3xl font-bold">nicquitin</h1>
          <p class="text-base-content/60 text-sm">track your nicotine usage</p>
        </div>
        <button class="btn btn-ghost btn-circle" @click="openSettings">⚙️</button>
      </div>

      <!-- Nicotine Level Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">nicotine in body</h2>

          <div>
            <progress
              class="progress w-full h-3"
              :class="gaugeColor"
              :value="Math.min(nicotineLevel, GAUGE_MAX)"
              :max="GAUGE_MAX"
            ></progress>
            <div class="flex justify-between mt-1 text-xs text-base-content/40">
              <span>0 mg</span><span>{{ GAUGE_MAX }} mg</span>
            </div>
          </div>

          <div class="flex items-end justify-between">
            <div>
              <span class="text-4xl font-mono font-bold tabular-nums">{{ nicotineLevel.toFixed(2) }}</span>
              <span class="text-sm text-base-content/50 ml-1">mg estimated</span>
            </div>
            <div class="text-right text-sm">
              <div v-if="nicotineLevel > CLEAN_THRESHOLD" class="text-base-content/60">
                clean in <span class="font-semibold">~{{ timeUntilClean }}</span>
              </div>
              <div v-else class="text-success font-semibold">nicotine free ✓</div>
              <div class="text-xs text-base-content/30 mt-0.5">t½ = {{ halfLifeH }}h</div>
            </div>
          </div>

          <div class="divider text-xs my-0">recovery milestones</div>
          <div v-if="lastUsed" class="space-y-2">
            <div v-for="m in milestones" :key="m.label" class="flex items-center gap-2 text-sm">
              <span class="shrink-0 w-5 text-center">{{ m.achieved ? '✅' : '🔘' }}</span>
              <span class="flex-1 leading-tight" :class="m.achieved ? 'text-success' : 'text-base-content/70'">
                {{ m.label }}
              </span>
              <span class="text-xs text-base-content/50 shrink-0 text-right">
                {{ m.achieved ? m.ago : 'in ' + m.remaining }}
              </span>
            </div>
          </div>
          <div v-else class="text-center text-base-content/40 text-sm py-2">
            log usage to see milestones
          </div>
        </div>
      </div>

      <!-- Timer Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body items-center text-center py-5">
          <template v-if="lastUsed">
            <p class="text-base-content/50 text-sm">time since last use</p>
            <div class="text-5xl font-mono font-bold tabular-nums my-2" :class="timerColor">{{ elapsed }}</div>
            <p class="text-base-content/40 text-xs">
              {{ formatDateTime(lastUsed.ts) }} &mdash; {{ lastUsed.emoji }} {{ lastUsed.product }}
              <span v-if="lastUsed.puffs"> · {{ lastUsed.puffs }} puffs</span>
            </p>
          </template>
          <template v-else>
            <p class="text-base-content/40 text-sm py-4">no usage logged yet</p>
          </template>
        </div>
      </div>

      <!-- Log Usage Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">log usage</h2>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in products"
              :key="p.id"
              class="btn btn-outline btn-sm flex-col h-auto py-3 gap-0.5"
              :class="pendingProduct?.id === p.id ? 'btn-primary border-primary' : ''"
              @click="selectProduct(p)"
            >
              <span class="text-xl">{{ p.emoji }}</span>
              <span class="text-xs leading-tight">{{ p.name }}</span>
              <span class="text-[10px] text-base-content/40">
                {{ p.nicotineMg.toFixed(3) }}mg{{ p.hasPuffCount ? '/puff' : '' }}
              </span>
              <!-- Cartridge remaining indicator -->
              <span
                v-if="p.hasPuffCount && cartridgeSessions[p.id]"
                class="text-[10px]"
                :class="cartridgePct(p.id) < 20 ? 'text-error' : 'text-base-content/40'"
              >
                {{ puffsRemaining(p.id) }} left
              </span>
            </button>
          </div>

          <!-- Puff count + cartridge panel -->
          <div v-if="pendingProduct?.hasPuffCount" class="bg-base-200 rounded-xl p-4 space-y-3">

            <!-- Cartridge status -->
            <div v-if="cartridgeSessions[pendingProduct.id]" class="space-y-1">
              <div class="flex justify-between items-center text-xs text-base-content/60">
                <span>{{ pendingProduct.emoji }} cartridge</span>
                <span>{{ puffsUsed(pendingProduct.id) }} / {{ cartridgeSessions[pendingProduct.id].totalPuffs }} puffs used</span>
              </div>
              <progress
                class="progress progress-info w-full h-2"
                :class="cartridgePct(pendingProduct.id) < 20 ? 'progress-error' : 'progress-info'"
                :value="puffsUsed(pendingProduct.id)"
                :max="cartridgeSessions[pendingProduct.id].totalPuffs"
              ></progress>
              <div class="flex justify-between text-xs">
                <span class="text-base-content/50">
                  {{ puffsRemaining(pendingProduct.id) }} puffs remaining
                  ({{ (puffsRemaining(pendingProduct.id) * pendingProduct.nicotineMg).toFixed(1) }}mg)
                </span>
                <button class="text-primary underline underline-offset-2" @click="newCartridge(pendingProduct.id)">
                  new cartridge / refill
                </button>
              </div>
            </div>
            <div v-else class="flex justify-between items-center text-xs text-base-content/50">
              <span>no cartridge session active</span>
              <button class="text-primary underline underline-offset-2" @click="newCartridge(pendingProduct.id)">
                start tracking cartridge
              </button>
            </div>

            <!-- Puff counter -->
            <div class="flex items-center gap-3">
              <button class="btn btn-sm btn-circle btn-ghost text-xl font-bold" @click="puffCount = Math.max(1, puffCount - 1)">−</button>
              <div class="flex-1 text-center">
                <div class="text-3xl font-bold font-mono tabular-nums">{{ puffCount }}</div>
                <div class="text-xs text-base-content/50">
                  puffs &mdash; {{ (puffCount * pendingProduct.nicotineMg).toFixed(2) }}mg
                </div>
              </div>
              <button class="btn btn-sm btn-circle btn-ghost text-xl font-bold" @click="puffCount++">+</button>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm flex-1" @click="confirmLog">log {{ puffCount }} puffs</button>
              <button class="btn btn-ghost btn-sm" @click="pendingProduct = null">cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="card bg-base-100 shadow" v-if="log.length">
        <div class="card-body gap-2">
          <div class="flex justify-between items-center">
            <h2 class="card-title text-base">history</h2>
            <button class="btn btn-ghost btn-xs text-error" @click="clearLog">clear all</button>
          </div>
          <ul class="space-y-2">
            <li v-for="entry in log" :key="entry.id" class="flex items-center justify-between text-sm gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="shrink-0">{{ entry.emoji }}</span>
                <div class="truncate">
                  <span class="font-medium">{{ entry.product }}</span>
                  <span v-if="entry.puffs" class="text-base-content/50 text-xs ml-1">{{ entry.puffs }} puffs</span>
                  <span v-if="entry.nicotineMg != null" class="text-base-content/40 text-xs ml-1">({{ entry.nicotineMg.toFixed(2) }}mg)</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-base-content/40 text-xs">{{ formatDateTime(entry.ts) }}</span>
                <button class="btn btn-ghost btn-xs text-error p-0 min-h-0 h-auto leading-none" @click="removeEntry(entry.id)">✕</button>
              </div>
            </li>
          </ul>
        </div>
      </div>

    </div>
  </div>

  <!-- Settings Modal -->
  <div v-if="showSettings" class="modal modal-open">
    <div class="modal-box w-full max-w-lg">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">configure products</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="closeSettings">✕</button>
      </div>

      <!-- Profile -->
      <div class="bg-base-200 rounded-xl px-4 py-3 space-y-3 mb-3">
        <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide">metabolism profile</div>

        <div class="grid grid-cols-2 gap-2">
          <label class="form-control">
            <div class="label py-0.5"><span class="label-text text-xs">biological sex</span></div>
            <select class="select select-sm select-bordered" v-model="editableProfile.sex">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label class="form-control">
            <div class="label py-0.5"><span class="label-text text-xs">CYP2A6 metabolizer</span></div>
            <select class="select select-sm select-bordered" v-model="editableProfile.metabolizer">
              <option value="slow">Slow (~3.5h t½)</option>
              <option value="normal">Normal (~2h t½)</option>
              <option value="fast">Fast (~1.4h t½)</option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" v-model="editableProfile.menthol" />
            <span class="text-sm">Menthol products</span>
          </label>
          <label v-if="editableProfile.sex === 'female'" class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" v-model="editableProfile.pregnant" />
            <span class="text-sm">Pregnant</span>
          </label>
          <label v-if="editableProfile.sex === 'female' && !editableProfile.pregnant" class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" v-model="editableProfile.contraceptives" />
            <span class="text-sm">Hormonal contraceptives</span>
          </label>
        </div>

        <div class="bg-base-100 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
          <span class="text-base-content/50">adjusted half-life</span>
          <span class="font-mono font-bold">{{ previewHalfLifeH.toFixed(2) }} h</span>
        </div>
      </div>

      <div class="divider text-xs my-0">products</div>

      <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        <div v-for="p in editableProducts" :key="p.id" class="bg-base-200 rounded-xl">
          <div
            class="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
            @click="toggleExpanded(p.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ p.emoji }}</span>
              <span class="font-medium text-sm">{{ p.name }}</span>
              <span class="text-xs text-base-content/40">
                {{ p.nicotineMg.toFixed(3) }}mg{{ p.hasPuffCount ? '/puff' : '' }}
                · {{ p.releaseType === 'slow' ? `slow (${p.releaseDurationH}h)` : 'instant' }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-base-content/40 text-xs">{{ expandedProduct === p.id ? '▲' : '▼' }}</span>
              <button class="btn btn-ghost btn-xs text-error ml-1" @click.stop="deleteProduct(p.id)">✕</button>
            </div>
          </div>

          <div v-if="expandedProduct === p.id" class="px-4 pb-4 space-y-2 border-t border-base-300 pt-3">
            <div class="grid grid-cols-2 gap-2">
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">name</span></div>
                <input class="input input-sm input-bordered" v-model="p.name" />
              </label>
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">emoji</span></div>
                <input class="input input-sm input-bordered" v-model="p.emoji" />
              </label>
            </div>

            <label class="form-control">
              <div class="label py-0.5"><span class="label-text text-xs">release type</span></div>
              <select class="select select-sm select-bordered" v-model="p.releaseType">
                <option value="instant">instant (cigarettes, vapes)</option>
                <option value="slow">slow release (patches, gum, pouches)</option>
              </select>
            </label>

            <label v-if="p.releaseType === 'slow'" class="form-control">
              <div class="label py-0.5"><span class="label-text text-xs">release duration (hours)</span></div>
              <input class="input input-sm input-bordered" type="number" min="0.1" step="0.1" v-model.number="p.releaseDurationH" />
            </label>

            <div class="flex items-center gap-2 pt-1">
              <input type="checkbox" class="checkbox checkbox-sm" :id="'pc-' + p.id" v-model="p.hasPuffCount" />
              <label :for="'pc-' + p.id" class="text-sm cursor-pointer">track puff count</label>
            </div>

            <!-- Cartridge calculator (puff-count products only) -->
            <template v-if="p.hasPuffCount">
              <div class="divider text-xs my-1">cartridge / pod calculator</div>

              <div class="flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-sm" :id="'cc-' + p.id" v-model="p.useCartridgeCalc" />
                <label :for="'cc-' + p.id" class="text-sm cursor-pointer">calculate mg/puff from cartridge</label>
              </div>

              <template v-if="p.useCartridgeCalc">
                <div class="grid grid-cols-2 gap-2">
                  <label class="form-control">
                    <div class="label py-0.5"><span class="label-text text-xs">cartridge nicotine (mg)</span></div>
                    <input class="input input-sm input-bordered" type="number" min="0.1" step="0.1" v-model.number="p.cartridgeNicotineMg" />
                  </label>
                  <label class="form-control">
                    <div class="label py-0.5"><span class="label-text text-xs">estimated puff count</span></div>
                    <input class="input input-sm input-bordered" type="number" min="1" step="1" v-model.number="p.cartridgeTotalPuffs" />
                  </label>
                </div>
                <div class="bg-base-100 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                  <span class="text-base-content/60">mg per puff</span>
                  <span class="font-mono font-bold">
                    {{ p.cartridgeTotalPuffs > 0 ? (p.cartridgeNicotineMg / p.cartridgeTotalPuffs).toFixed(4) : '—' }} mg
                  </span>
                </div>
              </template>
              <template v-else>
                <label class="form-control">
                  <div class="label py-0.5"><span class="label-text text-xs">nicotine per puff (mg)</span></div>
                  <input class="input input-sm input-bordered" type="number" min="0.001" step="0.001" v-model.number="p.nicotineMg" />
                </label>
              </template>
            </template>
            <template v-else>
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">nicotine per use (mg)</span></div>
                <input class="input input-sm input-bordered" type="number" min="0.01" step="0.01" v-model.number="p.nicotineMg" />
              </label>
            </template>
          </div>
        </div>
      </div>

      <button class="btn btn-outline btn-sm w-full mt-3" @click="addProduct">+ add product</button>

      <div class="modal-action mt-4">
        <button class="btn btn-primary" @click="saveSettings">save</button>
        <button class="btn btn-ghost" @click="closeSettings">cancel</button>
      </div>
    </div>
    <label class="modal-backdrop" @click="closeSettings"></label>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY    = 'nicquitin-log'
const PRODUCTS_KEY   = 'nicquitin-products'
const CARTRIDGE_KEY  = 'nicquitin-cartridges'
const PROFILE_KEY    = 'nicquitin-profile'
const BASE_HL_H      = 2       // population baseline nicotine half-life (hours)
const CLEAN_THRESHOLD = 0.05   // mg — considered nicotine-free
const GAUGE_MAX      = 15      // mg — full gauge scale

const DEFAULT_PROFILE = {
  sex:             'male',    // 'male' | 'female'
  metabolizer:     'normal',  // 'slow' | 'normal' | 'fast'
  menthol:         false,     // inhibits CYP2A6
  pregnant:        false,     // strongly upregulates CYP2A6
  contraceptives:  false,     // mild upregulation (female only)
}

const DEFAULT_PRODUCTS = [
  {
    id: 'cigarette', name: 'Cigarette', emoji: '🚬',
    nicotineMg: 1.1, releaseType: 'instant', releaseDurationH: 0,
    hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0,
  },
  {
    id: 'vape', name: 'Vape', emoji: '💨',
    nicotineMg: 0.1, releaseType: 'instant', releaseDurationH: 0,
    hasPuffCount: true, useCartridgeCalc: true, cartridgeNicotineMg: 20, cartridgeTotalPuffs: 200,
  },
  {
    id: 'patch', name: 'Patch (21mg)', emoji: '🩹',
    nicotineMg: 14, releaseType: 'slow', releaseDurationH: 16,
    hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0,
  },
  {
    id: 'gum', name: 'Gum (4mg)', emoji: '🟡',
    nicotineMg: 2, releaseType: 'slow', releaseDurationH: 0.5,
    hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0,
  },
  {
    id: 'pouch', name: 'Pouch', emoji: '🫙',
    nicotineMg: 3, releaseType: 'slow', releaseDurationH: 1,
    hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0,
  },
  {
    id: 'cigar', name: 'Cigar', emoji: '🍬',
    nicotineMg: 3, releaseType: 'instant', releaseDurationH: 0,
    hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0,
  },
]

const MILESTONE_DEFS = [
  { label: '❤️  Heart rate & BP drop',        offsetMs: 20  * 60 * 1000 },
  { label: '💨  Carbon monoxide clears',       offsetMs: 12  * 60 * 60 * 1000 },
  { label: '🧹  Nicotine-free (3 days)',       offsetMs: 3   * 24 * 60 * 60 * 1000 },
  { label: '🩸  Circulation improves (2 wks)', offsetMs: 14  * 24 * 60 * 60 * 1000 },
  { label: '🧠  Cravings greatly reduced',     offsetMs: 90  * 24 * 60 * 60 * 1000 },
  { label: '🏥  Heart disease risk halved',    offsetMs: 365 * 24 * 60 * 60 * 1000 },
]

// ─── State ───────────────────────────────────────────────────────────────────

const log              = ref([])
const products         = ref([])
const cartridgeSessions = ref({})
const profile          = ref({ ...DEFAULT_PROFILE })
const now              = ref(Date.now())
const showSettings     = ref(false)
const editableProducts = ref([])
const editableProfile  = ref({ ...DEFAULT_PROFILE })
const expandedProduct  = ref(null)
const pendingProduct   = ref(null)
const puffCount        = ref(10)

let timer = null

onMounted(() => {
  const savedLog = localStorage.getItem(STORAGE_KEY)
  if (savedLog) log.value = JSON.parse(savedLog)

  const savedProducts = localStorage.getItem(PRODUCTS_KEY)
  products.value = savedProducts ? JSON.parse(savedProducts) : DEFAULT_PRODUCTS.map(p => ({ ...p }))

  const savedCartridges = localStorage.getItem(CARTRIDGE_KEY)
  if (savedCartridges) cartridgeSessions.value = JSON.parse(savedCartridges)

  const savedProfile = localStorage.getItem(PROFILE_KEY)
  if (savedProfile) profile.value = { ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) }

  timer = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => clearInterval(timer))

// ─── Profile / adjusted half-life ────────────────────────────────────────────

const halfLifeH = computed(() => {
  const p = profile.value
  let hl = BASE_HL_H

  // Biological sex — women metabolize ~20% faster via CYP2A6 upregulation
  if (p.sex === 'female') hl *= 0.83

  // Pregnancy strongly upregulates CYP2A6 (~60% faster total vs male baseline)
  // Applied on top of sex, so female+pregnant ≈ 0.83×0.78 ≈ 0.65× → ~1.3h
  if (p.pregnant) hl *= 0.78

  // Hormonal contraceptives add modest upregulation (female, non-pregnant)
  if (p.sex === 'female' && p.contraceptives && !p.pregnant) hl *= 0.88

  // CYP2A6 genetic metabolizer speed — biggest single factor
  if (p.metabolizer === 'slow') hl *= 1.75   // ~3.5h baseline
  if (p.metabolizer === 'fast') hl *= 0.70   // ~1.4h baseline

  // Menthol inhibits CYP2A6 — slower clearance
  if (p.menthol) hl *= 1.20

  return Math.round(hl * 100) / 100
})

// Preview half-life using editableProfile (for live settings display)
const previewHalfLifeH = computed(() => {
  const p = editableProfile.value
  let hl = BASE_HL_H
  if (p.sex === 'female') hl *= 0.83
  if (p.pregnant) hl *= 0.78
  if (p.sex === 'female' && p.contraceptives && !p.pregnant) hl *= 0.88
  if (p.metabolizer === 'slow') hl *= 1.75
  if (p.metabolizer === 'fast') hl *= 0.70
  if (p.menthol) hl *= 1.20
  return Math.round(hl * 100) / 100
})

// ─── Cartridge tracking ───────────────────────────────────────────────────────

function puffsUsed(productId) {
  const session = cartridgeSessions.value[productId]
  if (!session) return 0
  return log.value
    .filter(e => e.productId === productId && e.puffs != null && e.ts >= session.startTs)
    .reduce((sum, e) => sum + e.puffs, 0)
}

function puffsRemaining(productId) {
  const session = cartridgeSessions.value[productId]
  if (!session) return 0
  return Math.max(0, session.totalPuffs - puffsUsed(productId))
}

function cartridgePct(productId) {
  const session = cartridgeSessions.value[productId]
  if (!session || session.totalPuffs === 0) return 100
  return Math.round((puffsRemaining(productId) / session.totalPuffs) * 100)
}

function newCartridge(productId) {
  const p = products.value.find(x => x.id === productId)
  if (!p) return
  cartridgeSessions.value = {
    ...cartridgeSessions.value,
    [productId]: { startTs: Date.now(), totalPuffs: p.cartridgeTotalPuffs || 200 },
  }
  localStorage.setItem(CARTRIDGE_KEY, JSON.stringify(cartridgeSessions.value))
}

// ─── Pharmacokinetics ────────────────────────────────────────────────────────

function nicotineFromEntry(entry, atMs, hl = halfLifeH.value) {
  const elapsedH = (atMs - entry.ts) / 3_600_000
  if (elapsedH <= 0) return 0
  const dose   = entry.nicotineMg ?? 0
  const lambda = Math.LN2 / hl

  if (entry.releaseType !== 'slow') {
    return dose * Math.exp(-lambda * elapsedH)
  }
  const D = Math.max(entry.releaseDurationH || 1, 0.01)
  if (elapsedH < D) {
    return (dose / D) * (1 - Math.exp(-lambda * elapsedH)) / lambda
  }
  return (dose / D) * Math.exp(-lambda * (elapsedH - D)) * (1 - Math.exp(-lambda * D)) / lambda
}

const nicotineLevel = computed(() =>
  Math.max(0, log.value.reduce((sum, e) => sum + nicotineFromEntry(e, now.value), 0))
)

const gaugeColor = computed(() => {
  const ratio = nicotineLevel.value / GAUGE_MAX
  if (ratio < 0.25) return 'progress-success'
  if (ratio < 0.6)  return 'progress-warning'
  return 'progress-error'
})

const timeUntilClean = computed(() => {
  if (nicotineLevel.value <= CLEAN_THRESHOLD) return null
  const STEP = 3_600_000
  const hl = halfLifeH.value
  let lastAbove = now.value
  for (let i = 1; i <= 14 * 24; i++) {
    const t = now.value + i * STEP
    const lvl = log.value.reduce((s, e) => s + nicotineFromEntry(e, t, hl), 0)
    if (lvl > CLEAN_THRESHOLD) lastAbove = t
  }
  return formatDuration(lastAbove - now.value + STEP)
})

// ─── Logging ─────────────────────────────────────────────────────────────────

function selectProduct(p) {
  if (p.hasPuffCount) {
    pendingProduct.value = pendingProduct.value?.id === p.id ? null : p
    puffCount.value = 10
  } else {
    doLog(p, null)
    pendingProduct.value = null
  }
}

function confirmLog() {
  if (!pendingProduct.value) return
  doLog(pendingProduct.value, puffCount.value)
  pendingProduct.value = null
}

function doLog(p, puffs) {
  const nicotineMg = puffs != null ? puffs * p.nicotineMg : p.nicotineMg
  log.value.unshift({
    id: Date.now(),
    productId: p.id,
    product: p.name,
    emoji: p.emoji,
    nicotineMg,
    releaseType: p.releaseType,
    releaseDurationH: p.releaseDurationH,
    puffs,
    ts: Date.now(),
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
}

function removeEntry(id) {
  log.value = log.value.filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
}

function clearLog() {
  log.value = []
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
}

// ─── Timer ───────────────────────────────────────────────────────────────────

const lastUsed = computed(() => log.value[0] ?? null)

const elapsed = computed(() => {
  if (!lastUsed.value) return null
  const s   = Math.floor((now.value - lastUsed.value.ts) / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
  if (m > 0) return `${m}m ${String(sec).padStart(2,'0')}s`
  return `${sec}s`
})

const timerColor = computed(() => {
  if (!lastUsed.value) return ''
  const s = (now.value - lastUsed.value.ts) / 1000
  if (s < 1800) return 'text-error'
  if (s < 7200) return 'text-warning'
  return 'text-success'
})

// ─── Milestones ──────────────────────────────────────────────────────────────

const milestones = computed(() => {
  if (!lastUsed.value) return []
  return MILESTONE_DEFS.map(m => {
    const ts       = lastUsed.value.ts + m.offsetMs
    const achieved = now.value >= ts
    return {
      label:     m.label,
      ts,
      achieved,
      remaining: achieved ? null : formatDuration(ts - now.value),
      ago:       achieved ? relativeAgo(ts) : null,
    }
  })
})

// ─── Settings ────────────────────────────────────────────────────────────────

function openSettings() {
  editableProducts.value = products.value.map(p => ({ ...p }))
  editableProfile.value  = { ...profile.value }
  expandedProduct.value  = null
  showSettings.value     = true
}

function closeSettings() {
  showSettings.value = false
}

function saveSettings() {
  products.value = editableProducts.value.map(p => {
    if (p.hasPuffCount && p.useCartridgeCalc && p.cartridgeTotalPuffs > 0) {
      return { ...p, nicotineMg: p.cartridgeNicotineMg / p.cartridgeTotalPuffs }
    }
    return p
  })
  profile.value = { ...editableProfile.value }
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.value))
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
  showSettings.value = false
}

function toggleExpanded(id) {
  expandedProduct.value = expandedProduct.value === id ? null : id
}

function deleteProduct(id) {
  editableProducts.value = editableProducts.value.filter(p => p.id !== id)
  if (expandedProduct.value === id) expandedProduct.value = null
}

function addProduct() {
  const id = `custom-${Date.now()}`
  editableProducts.value.push({
    id,
    name: 'New Product',
    emoji: '🟣',
    nicotineMg: 1,
    releaseType: 'instant',
    releaseDurationH: 1,
    hasPuffCount: false,
    useCartridgeCalc: false,
    cartridgeNicotineMg: 0,
    cartridgeTotalPuffs: 0,
  })
  expandedProduct.value = id
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(ms) {
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

function relativeAgo(ts) {
  const diff = now.value - ts
  if (diff < 3_600_000)  return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}
</script>
