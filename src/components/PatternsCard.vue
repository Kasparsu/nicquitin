<template>
  <div class="card bg-base-100 shadow" v-if="hasEnoughData">
    <div class="card-body gap-3">
      <h2 class="card-title text-base">patterns</h2>

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-base-200 rounded-lg p-2">
          <div class="text-sm font-bold font-mono">{{ formatDuration(avgIntervalMs) }}</div>
          <div class="text-[10px] text-base-content/50 mt-0.5">avg interval</div>
        </div>
        <div class="bg-base-200 rounded-lg p-2">
          <div class="text-sm font-bold font-mono">{{ usesPerDay7d.toFixed(1) }}<span class="text-xs font-normal">/day</span></div>
          <div class="text-[10px] text-base-content/50 mt-0.5">frequency</div>
        </div>
        <div class="bg-base-200 rounded-lg p-2">
          <div class="text-sm font-bold" :class="trendColor">{{ trendLabel }}</div>
          <div class="text-[10px] text-base-content/50 mt-0.5">7-day trend</div>
        </div>
      </div>

      <div v-if="peakHours.length" class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-base-content/40">peak times</span>
        <span v-for="ph in peakHours" :key="ph.label" class="badge badge-ghost badge-sm">{{ ph.label }}</span>
        <span class="text-xs text-base-content/30 ml-auto">based on {{ log.length }} uses</span>
      </div>

      <div v-if="progressState.bestIntervalMs > 0" class="flex items-center justify-between text-xs text-base-content/40">
        <span>personal best wait</span>
        <span class="font-mono font-medium text-base-content/60">{{ formatDuration(progressState.bestIntervalMs) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { formatDuration } from '../lib/format.js'
import { useLogStore }      from '../stores/log.js'
import { useProgressStore } from '../stores/progress.js'

const { log, hasEnoughData, avgIntervalMs, usesPerDay7d, trend, peakHours } = storeToRefs(useLogStore())
const { progressState } = storeToRefs(useProgressStore())

const trendLabel = computed(() => ({ improving: '↗ improving', worsening: '↘ slipping', stable: '→ stable', neutral: '— —' }[trend.value]))
const trendColor = computed(() => ({ improving: 'text-success', worsening: 'text-error', stable: 'text-warning', neutral: 'text-base-content/40' }[trend.value]))
</script>
