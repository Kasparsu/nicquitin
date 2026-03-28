<template>
  <div v-if="hasActiveSessions" class="card bg-base-100 shadow">
    <div class="card-body gap-3 py-4">
      <h2 class="card-title text-base">in use</h2>

      <!-- Patch / Gum and other single-session products -->
      <div v-for="(session, productId) in activeSessions" :key="productId" class="space-y-2">
        <template v-if="productById(productId)">
          <div class="flex justify-between items-center text-sm">
            <span class="font-medium">{{ productById(productId).emoji }} {{ productById(productId).name }}</span>
            <span class="font-mono text-xs text-base-content/60">{{ sessionElapsed(productId) }}</span>
          </div>
          <template v-if="productById(productId).releaseDurationH > 0">
            <div class="flex justify-between text-xs mb-0.5">
              <span :class="sessionProgress(productId) >= 1 ? 'text-success font-medium' : 'text-base-content/50'">
                {{ sessionProgress(productId) >= 1 ? '✓ run its course' : sessionTimeRemaining(productId) + ' remaining' }}
              </span>
              <span class="text-base-content/40">{{ Math.min(100, Math.round(sessionProgress(productId) * 100)) }}%</span>
            </div>
            <progress
              class="progress w-full h-2"
              :class="sessionProgress(productId) >= 1 ? 'progress-success' : 'progress-primary'"
              :value="Math.min(sessionProgress(productId), 1)"
              max="1"
            ></progress>
            <p class="text-xs" :class="sessionProgress(productId) >= 1 ? 'text-success/70' : 'text-base-content/30'">
              {{ sessionProgress(productId) >= 1
                ? 'full ' + productById(productId).nicotineMg.toFixed(1) + 'mg absorbed — remove when ready'
                : '~' + sessionEstimatedDose(productId) + 'mg absorbed if removed now' }}
            </p>
          </template>
          <template v-if="productById(productId).hasSwallowOption">
            <div class="flex gap-2 pt-1">
              <button class="btn btn-outline btn-sm flex-1" @click="stopSession(productId, { swallowed: false })">🚮 spit out</button>
              <button class="btn btn-primary btn-sm flex-1" @click="stopSession(productId, { swallowed: true })">⬇ swallow</button>
            </div>
          </template>
          <template v-else>
            <button class="btn btn-primary btn-sm w-full mt-1" @click="stopSession(productId)">remove {{ productById(productId).emoji }}</button>
          </template>
        </template>
      </div>

      <!-- Pouch sessions (multiple, pauseable) -->
      <div v-for="s in pouchSessions" :key="s.id" class="space-y-2 pt-1" :class="{ 'opacity-60': s.paused }">
        <div class="flex justify-between items-center text-sm">
          <span class="font-medium">
            🫙 Pouch
            <span v-if="s.reuseCount > 0" class="text-warning text-xs ml-1">reuse ×{{ s.reuseCount }}</span>
          </span>
          <span class="font-mono text-xs" :class="s.paused ? 'text-base-content/40' : 'text-base-content/60'">
            {{ s.paused ? '⏸ in tin' : pouchElapsedDisplay(s) }}
          </span>
        </div>
        <div class="space-y-0.5">
          <div class="flex justify-between text-xs">
            <span :class="pouchProgressVal(s) >= 1 ? 'text-success font-medium' : s.paused ? 'text-base-content/40' : 'text-base-content/50'">
              {{ pouchProgressVal(s) >= 1 ? '✓ fully absorbed' : pouchTimeRemainingDisplay(s) }}
            </span>
            <span class="text-base-content/40">{{ Math.min(100, Math.round(pouchProgressVal(s) * 100)) }}%</span>
          </div>
          <progress
            class="progress w-full h-2"
            :class="pouchProgressVal(s) >= 1 ? 'progress-success' : s.paused ? 'progress-warning' : 'progress-primary'"
            :value="Math.min(pouchProgressVal(s), 1)"
            max="1"
          ></progress>
          <p class="text-xs text-base-content/30">
            ~{{ pouchEstimatedDoseDisplay(s) }}mg absorbed{{ s.paused ? ' (paused)' : ' if removed now' }}
          </p>
        </div>
        <div class="flex gap-2 pt-1">
          <button v-if="s.paused" class="btn btn-primary btn-sm flex-1" @click="resumePouch(s.id)">▶ put back in</button>
          <button v-else class="btn btn-outline btn-sm flex-1" @click="pausePouch(s.id)">⏸ put in tin</button>
          <button class="btn btn-error btn-outline btn-sm flex-1" @click="removePouchDone(s.id)">✓ done</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useProductsStore } from '../stores/products.js'
import { useSessionsStore } from '../stores/sessions.js'

const { productById } = useProductsStore()

const sessionsStore = useSessionsStore()
const { activeSessions, pouchSessions, hasActiveSessions } = storeToRefs(sessionsStore)
const {
  stopSession, pausePouch, resumePouch, removePouchDone,
  sessionElapsed, sessionProgress, sessionTimeRemaining, sessionEstimatedDose,
  pouchProgressVal, pouchElapsedDisplay, pouchTimeRemainingDisplay, pouchEstimatedDoseDisplay,
} = sessionsStore
</script>
