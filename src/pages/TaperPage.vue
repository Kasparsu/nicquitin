<template>
  <div class="space-y-4">

    <!-- Not started -->
    <template v-if="!taperState.active">
      <div class="bg-base-200 rounded-xl px-4 py-4 space-y-3">
        <div class="text-lg font-bold">Taper Plan</div>
        <p class="text-sm text-base-content/60">
          A gradual 40-day nicotine reduction plan using patches from the Estonian market.
          Steps down in small increments to minimize withdrawal.
        </p>
        <button class="btn btn-primary btn-sm w-full" @click="startDefault">Start default plan</button>
      </div>

      <!-- Preview all ranks -->
      <div class="bg-base-200 rounded-xl px-4 py-3 space-y-2">
        <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide">all delivery options (sorted)</div>
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th>#</th>
                <th>Combination</th>
                <th class="text-right">mg/h</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in DELIVERY_TABLE" :key="d.rank">
                <td class="font-mono text-base-content/40">{{ d.rank }}</td>
                <td class="text-xs">{{ d.combo }}</td>
                <td class="text-right font-mono">{{ d.hourlyRate.toFixed(2) }}</td>
                <td class="text-right font-mono text-base-content/50">{{ d.totalMg }}mg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Active plan -->
    <template v-else-if="!isComplete">

      <!-- Overall progress -->
      <div class="bg-base-200 rounded-xl px-4 py-4 space-y-2">
        <div class="flex justify-between items-center">
          <div class="text-lg font-bold">Taper Plan</div>
          <div class="text-xs text-base-content/50">day {{ dayInPlan }} of {{ totalDays }}</div>
        </div>
        <progress class="progress progress-primary w-full h-2" :value="overallProgress" max="1"></progress>
        <div class="flex justify-between text-xs text-base-content/40">
          <span>{{ Math.round(overallProgress * 100) }}% complete</span>
          <span v-if="estimatedEndTs">done ~{{ new Date(estimatedEndTs).toLocaleDateString() }}</span>
        </div>
      </div>

      <!-- Current phase card -->
      <div v-if="currentPhaseData" class="bg-primary/10 border border-primary/30 rounded-xl px-4 py-4 space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs text-primary font-semibold uppercase tracking-wide">Phase {{ currentPhaseData.phase }} — {{ currentPhaseData.label }}</div>
            <div class="text-2xl font-mono font-bold mt-1">{{ currentPhaseData.combo }}</div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-mono font-bold text-primary">{{ currentPhaseData.hourlyRate.toFixed(2) }}</div>
            <div class="text-xs text-base-content/50">mg/h</div>
          </div>
        </div>
        <progress class="progress progress-primary w-full h-2" :value="phaseProgress" max="1"></progress>
        <div class="flex justify-between text-xs">
          <span class="text-base-content/50">day {{ dayInPhase }} of {{ currentPhaseData.days }}</span>
          <span v-if="daysLeftInPhase > 0" class="text-base-content/50">{{ daysLeftInPhase }} days to go</span>
          <span v-else class="text-success font-semibold">ready to advance</span>
        </div>
        <div v-if="currentPhaseData.note" class="text-xs text-base-content/40 bg-base-200 rounded-lg px-3 py-2">
          {{ currentPhaseData.note }}
        </div>
        <button
          class="btn btn-sm w-full"
          :class="daysLeftInPhase <= 0 ? 'btn-primary' : 'btn-outline'"
          @click="advancePhase"
        >
          {{ state.currentPhase < plan.length - 1 ? 'advance to next phase' : 'complete plan' }}
        </button>
      </div>

      <!-- Phase timeline -->
      <div class="bg-base-200 rounded-xl px-4 py-3 space-y-1">
        <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">phases</div>
        <div
          v-for="(p, i) in plan" :key="i"
          class="flex items-center gap-3 py-1.5 text-sm cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
          :class="i === state.currentPhase ? 'bg-primary/10' : i < state.currentPhase ? 'opacity-50' : ''"
          @click="setPhase(i)"
        >
          <span class="w-5 text-center shrink-0">
            <template v-if="i < state.currentPhase">&#x2705;</template>
            <template v-else-if="i === state.currentPhase">&#x25B6;&#xFE0F;</template>
            <template v-else>&#x26AA;</template>
          </span>
          <span class="flex-1 text-xs">
            <span class="font-semibold">{{ p.label }}</span>
            <span class="text-base-content/40 ml-1">{{ p.combo }}</span>
          </span>
          <span class="font-mono text-xs text-base-content/50">{{ p.hourlyRate.toFixed(2) }} mg/h</span>
          <span class="text-xs text-base-content/40 w-10 text-right">{{ p.days }}d</span>
        </div>
      </div>

      <!-- Shopping list -->
      <div class="bg-base-200 rounded-xl px-4 py-3 space-y-2">
        <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide">shopping list</div>
        <div v-for="item in shoppingList" :key="item.id" class="flex justify-between text-sm">
          <span>{{ formatProductName(item.id) }}</span>
          <span class="font-mono text-base-content/50">{{ item.packs }} pack{{ item.packs > 1 ? 's' : '' }} ({{ Math.ceil(item.days) }} days)</span>
        </div>
      </div>

      <!-- Stop plan -->
      <button class="btn btn-ghost btn-xs w-full text-error/60" @click="confirmStop">stop plan</button>

    </template>

    <!-- Completed -->
    <template v-else>
      <div class="bg-success/10 border border-success/30 rounded-xl px-4 py-6 text-center space-y-3">
        <div class="text-4xl">&#127942;</div>
        <div class="text-lg font-bold">Plan Complete!</div>
        <p class="text-sm text-base-content/60">
          You've completed your taper plan. Your body is now adjusted to zero nicotine delivery.
        </p>
        <button class="btn btn-ghost btn-sm" @click="stopPlan">dismiss</button>
      </div>
    </template>

  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useTaperStore, DELIVERY_TABLE } from '../stores/taper.js'

const taperStore = useTaperStore()
const {
  state, plan, currentPhaseData, totalDays,
  dayInPlan, dayInPhase, daysLeftInPhase, phaseProgress, overallProgress,
  isComplete, estimatedEndTs, shoppingList,
} = storeToRefs(taperStore)

const { startPlan, advancePhase, setPhase, stopPlan } = taperStore

const taperState = state

function startDefault() {
  startPlan(null)
}

function confirmStop() {
  if (confirm('Stop the taper plan? Your progress will be cleared.')) {
    stopPlan()
  }
}

function formatProductName(id) {
  const names = {
    'nicorette-25-16h': 'Nicorette 25mg/16h',
    'nicorette-15-16h': 'Nicorette 15mg/16h',
    'nicorette-10-16h': 'Nicorette 10mg/16h',
    'niquitin-21-24h':  'NiQuitin 21mg/24h',
    'niquitin-14-24h':  'NiQuitin 14mg/24h',
  }
  return names[id] ?? id
}
</script>
