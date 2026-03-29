<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-3">
      <h2 class="card-title text-base">log usage</h2>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="p in products" :key="p.id"
          class="btn btn-outline btn-sm flex-col h-auto py-3 gap-0.5"
          :class="[
            pendingProduct?.id === p.id ? 'btn-primary border-primary' :
            (p.releaseType === 'slow' && sessionsFor(p.id).length > 0) ? 'btn-success border-success opacity-70' : '',
          ]"
          @click="selectProduct(p)"
        >
          <span class="text-xl">{{ p.emoji }}</span>
          <span class="text-xs leading-tight">{{ p.name }}</span>
          <span class="text-[10px] text-base-content/40">
            {{ p.nicotineMg.toFixed(3) }}mg{{ p.hasPuffCount ? '/puff' : '' }}
          </span>
          <span v-if="p.releaseType === 'slow' && sessionsFor(p.id).length > 1" class="text-[10px] text-primary font-mono">
            {{ sessionsFor(p.id).length }} active · + new
          </span>
          <span v-else-if="p.releaseType === 'slow' && sessionsFor(p.id).length === 1" class="text-[10px] font-mono"
            :class="sessionProgress(sessionsFor(p.id)[0]) >= 1 ? 'text-success' : 'text-primary'">
            {{ sessionProgress(sessionsFor(p.id)[0]) >= 1 ? '✓ done' : '⏱ ' + sessionElapsedShort(sessionsFor(p.id)[0]) }}
          </span>
          <span v-else-if="p.releaseType === 'slow'" class="text-[10px] text-base-content/30">tap to start</span>
          <span
            v-else-if="p.hasPuffCount && cartridgeSessions[p.id]"
            class="text-[10px]"
            :class="cartridgePct(p.id) < 20 ? 'text-error' : 'text-base-content/40'"
          >{{ puffsRemaining(p.id) }} left</span>
        </button>
      </div>

      <!-- Puff count + cartridge panel -->
      <div v-if="pendingProduct?.hasPuffCount" class="bg-base-200 rounded-xl p-4 space-y-3">

        <!-- Active cartridge stats -->
        <div v-if="cartridgeSessions[pendingProduct.id] && !refillConfirm" class="space-y-1.5">
          <div class="flex justify-between items-center text-xs text-base-content/60">
            <span>{{ pendingProduct.emoji }} cartridge</span>
            <span
              :class="puffsUsed(pendingProduct.id) > cartridgeSessions[pendingProduct.id].totalPuffs ? 'text-warning' : ''"
            >{{ puffsUsed(pendingProduct.id) }} / {{ cartridgeSessions[pendingProduct.id].totalPuffs }} puffs</span>
          </div>
          <progress
            class="progress w-full h-2"
            :class="puffsUsed(pendingProduct.id) > cartridgeSessions[pendingProduct.id].totalPuffs ? 'progress-warning' : cartridgePct(pendingProduct.id) < 20 ? 'progress-error' : 'progress-info'"
            :value="puffsUsed(pendingProduct.id)"
            :max="cartridgeSessions[pendingProduct.id].totalPuffs"
          ></progress>
          <div class="flex justify-between text-xs">
            <span class="text-base-content/50">
              {{ (puffsUsed(pendingProduct.id) * pendingProduct.nicotineMg).toFixed(2) }}mg consumed
              · {{ pendingProduct.nicotineMg.toFixed(4) }}mg/puff
            </span>
            <button class="text-primary underline underline-offset-2" @click="initiateRefill(pendingProduct.id)">refill</button>
          </div>
        </div>

        <!-- No session yet -->
        <div v-else-if="!cartridgeSessions[pendingProduct.id] && !refillConfirm" class="flex justify-between items-center text-xs text-base-content/50">
          <span>no cartridge session</span>
          <button class="text-primary underline underline-offset-2" @click="newCartridge(pendingProduct.id)">start tracking</button>
        </div>

        <!-- Refill confirmation -->
        <div v-if="refillConfirm" class="bg-base-100 rounded-xl p-3 space-y-2.5 border border-primary/30">
          <p class="text-sm font-semibold">refill summary</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-base-content/60">
            <span>puffs this session</span>
            <span class="font-mono font-medium text-base-content">{{ refillConfirm.actualPuffs }}</span>
            <span>cartridge nicotine</span>
            <span class="font-mono font-medium text-base-content">{{ refillConfirm.nicotineMg.toFixed(1) }}mg</span>
            <span>actual mg/puff</span>
            <span class="font-mono font-medium text-base-content">
              {{ refillConfirm.actualPuffs > 0 ? (refillConfirm.nicotineMg / refillConfirm.actualPuffs).toFixed(4) : '—' }}mg
            </span>
          </div>
          <label class="form-control">
            <div class="label py-0.5">
              <span class="label-text text-xs">update puff estimate for next refill</span>
            </div>
            <input
              class="input input-sm input-bordered font-mono"
              type="number" min="1" step="1"
              v-model.number="refillConfirm.newEstimate"
            />
            <div class="label py-0.5">
              <span class="label-text-alt text-xs text-base-content/40">
                → {{ refillConfirm.newEstimate > 0 ? (refillConfirm.nicotineMg / refillConfirm.newEstimate).toFixed(4) : '—' }}mg/puff next session
              </span>
            </div>
          </label>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm flex-1" @click="confirmRefill(pendingProduct.id)">confirm refill</button>
            <button class="btn btn-ghost btn-sm" @click="refillConfirm = null">cancel</button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button class="btn btn-sm btn-circle btn-ghost text-xl font-bold" @click="puffCount = Math.max(1, puffCount - 1)">−</button>
          <div class="flex-1 text-center">
            <div class="text-3xl font-bold font-mono tabular-nums">{{ puffCount }}</div>
            <div class="text-xs text-base-content/50">puffs &mdash; {{ (puffCount * pendingProduct.nicotineMg).toFixed(2) }}mg</div>
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
</template>

<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore }      from '../stores/log.js'
import { useProductsStore } from '../stores/products.js'
import { useSessionsStore } from '../stores/sessions.js'
import { useProgressStore } from '../stores/progress.js'

const logStore      = useLogStore()
const productsStore = useProductsStore()
const sessionsStore = useSessionsStore()
const progressStore = useProgressStore()

const { log, hasEnoughData } = storeToRefs(logStore)
const { products, cartridgeSessions } = storeToRefs(productsStore)
const { activeSessions } = storeToRefs(sessionsStore)

const { puffsUsed, puffsRemaining, cartridgePct, newCartridge } = productsStore
const { startSession, sessionProgress, sessionElapsedShort } = sessionsStore

function sessionsFor(productId) {
  return activeSessions.value.filter(s => s.productId === productId)
}

// ─── UI state ─────────────────────────────────────────────────────────────────

const pendingProduct = ref(null)
const puffCount      = ref(10)
const refillConfirm  = ref(null)

// ─── Logging ─────────────────────────────────────────────────────────────────

function selectProduct(p) {
  if (p.releaseType === 'slow') {
    startSession(p.id)
    pendingProduct.value = null
    return
  }
  if (p.hasPuffCount) {
    const closing = pendingProduct.value?.id === p.id
    pendingProduct.value = closing ? null : p
    if (closing || pendingProduct.value?.id !== refillConfirm.value?.productId) refillConfirm.value = null
    puffCount.value = 10
  } else {
    doLog(p, null)
    pendingProduct.value = null
    refillConfirm.value = null
  }
}

function confirmLog() {
  if (!pendingProduct.value) return
  doLog(pendingProduct.value, puffCount.value)
  pendingProduct.value = null
}

function doLog(p, puffs) {
  const prevEntry  = log.value[0]
  const ts         = Date.now()
  const nicotineMg = puffs != null ? puffs * p.nicotineMg : p.nicotineMg

  logStore.addEntry({ id: ts, productId: p.id, product: p.name, emoji: p.emoji, nicotineMg, releaseType: p.releaseType, releaseDurationH: p.releaseDurationH, puffs, ts, producesCO: p.producesCO ?? false })

  if (prevEntry && hasEnoughData.value) {
    const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
    const interval = ts - prevEnd
    if (interval >= 5 * 60_000) progressStore.checkBeat(interval)
  }
}

// ─── Cartridge refill ─────────────────────────────────────────────────────────

function initiateRefill(productId) {
  const actual = puffsUsed(productId)
  if (actual === 0) { newCartridge(productId); return }
  const p = productsStore.productById(productId)
  refillConfirm.value = { productId, actualPuffs: actual, newEstimate: actual, nicotineMg: p?.cartridgeNicotineMg ?? 0 }
}

function confirmRefill(productId) {
  if (!refillConfirm.value) return
  productsStore.applyRefill(productId, refillConfirm.value.newEstimate)
  refillConfirm.value = null
}
</script>
