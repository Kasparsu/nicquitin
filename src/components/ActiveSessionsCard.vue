<template>
  <div v-if="hasActiveSessions" class="card bg-base-100 shadow">
    <div class="card-body gap-3 py-4">
      <h2 class="card-title text-base">in use</h2>

      <div v-for="s in sessions" :key="s.id" class="space-y-2" :class="{ 'opacity-60': s.paused }">
        <template v-if="productById(s.productId)">
          <div class="flex justify-between items-center text-sm">
            <span class="font-medium">
              {{ productById(s.productId).emoji }} {{ productById(s.productId).name }}
              <span v-if="s.reuseCount > 0" class="text-warning text-xs ml-1">reuse ×{{ s.reuseCount }}</span>
            </span>
            <span class="font-mono text-xs" :class="s.paused ? 'text-base-content/40' : 'text-base-content/60'">
              {{ s.paused ? '⏸ paused' : sessionElapsed(s) }}
            </span>
          </div>

          <template v-if="productById(s.productId).releaseDurationH > 0">
            <div class="flex justify-between text-xs mb-0.5">
              <span :class="sessionProgress(s) >= 1 ? 'text-success font-medium' : s.paused ? 'text-base-content/40' : 'text-base-content/50'">
                {{ sessionProgress(s) >= 1 ? '✓ run its course' : (sessionTimeRemaining(s) + ' remaining') }}
              </span>
              <span class="text-base-content/40">{{ Math.min(100, Math.round(sessionProgress(s) * 100)) }}%</span>
            </div>
            <progress
              class="progress w-full h-2"
              :class="sessionProgress(s) >= 1 ? 'progress-success' : s.paused ? 'progress-warning' : 'progress-primary'"
              :value="Math.min(sessionProgress(s), 1)"
              max="1"
            ></progress>
            <p class="text-xs" :class="sessionProgress(s) >= 1 ? 'text-success/70' : 'text-base-content/30'">
              {{ sessionProgress(s) >= 1
                ? 'full ' + productById(s.productId).nicotineMg.toFixed(1) + 'mg absorbed — remove when ready'
                : '~' + sessionEstimatedDose(s) + 'mg absorbed' + (s.paused ? ' (paused)' : ' if removed now') }}
            </p>
          </template>

          <!-- Pause / resume (products with hasReuseOption e.g. pouches) -->
          <div v-if="productById(s.productId).hasReuseOption" class="flex gap-2 pt-1">
            <button v-if="s.paused" class="btn btn-primary btn-sm flex-1" @click="resumeSession(s.id)">▶ put back in</button>
            <button v-else class="btn btn-outline btn-sm flex-1" @click="pauseSession(s.id)">⏸ put in tin</button>
            <button class="btn btn-error btn-outline btn-sm flex-1" @click="stopSession(s.id)">✓ done</button>
          </div>

          <!-- Spit / swallow (products with hasSwallowOption e.g. gum) -->
          <div v-else-if="productById(s.productId).hasSwallowOption" class="flex gap-2 pt-1">
            <button class="btn btn-outline btn-sm flex-1" @click="stopSession(s.id, { swallowed: false })">🚮 spit out</button>
            <button class="btn btn-primary btn-sm flex-1" @click="stopSession(s.id, { swallowed: true })">⬇ swallow</button>
          </div>

          <!-- Standard remove -->
          <template v-else>
            <button class="btn btn-primary btn-sm w-full mt-1" @click="stopSession(s.id)">
              remove {{ productById(s.productId).emoji }}
            </button>
          </template>
        </template>
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
const { sessions, hasActiveSessions } = storeToRefs(sessionsStore)
const {
  stopSession, pauseSession, resumeSession,
  sessionElapsed, sessionProgress, sessionTimeRemaining, sessionEstimatedDose,
} = sessionsStore
</script>
