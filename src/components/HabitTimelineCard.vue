<template>
  <div class="card bg-base-100 shadow" v-if="hasEnoughData">
    <div class="card-body gap-3">
      <div class="flex justify-between items-center">
        <h2 class="card-title text-base">habit timeline</h2>
        <span class="text-xs text-base-content/30">beat 4 in 10 to stay on track</span>
      </div>

      <div class="relative">
        <div class="absolute left-[11px] top-4 bottom-4 w-0.5 bg-base-300"></div>

        <div class="space-y-2">
          <div
            v-for="(m, i) in habitTimeline"
            :key="m.id"
            class="flex items-start gap-3 relative"
          >
            <div
              class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold z-10 mt-0.5"
              :class="m.achieved ? 'bg-success text-success-content' : m.isCurrent ? 'bg-primary text-primary-content ring-2 ring-primary ring-offset-2 ring-offset-base-100' : 'bg-base-300 text-base-content/40'"
            >
              {{ m.achieved ? '✓' : i + 1 }}
            </div>

            <div class="flex-1 pb-1">
              <div class="flex justify-between items-baseline">
                <span
                  class="text-sm font-medium leading-tight"
                  :class="m.achieved ? 'text-success' : m.isCurrent ? 'text-primary' : 'text-base-content/50'"
                >{{ m.label }}</span>
                <span class="text-xs text-base-content/40 shrink-0 ml-2">
                  {{ m.achieved ? 'reached' : m.isCurrent ? 'current' : m.etaLabel }}
                </span>
              </div>
              <div class="text-xs text-base-content/40 mt-0.5">
                every {{ m.intervalLabel }} &mdash; ~{{ m.usesPerDayLabel }}/day
              </div>
              <div v-if="m.isCurrent && avgIntervalMs > 0" class="mt-1.5">
                <progress
                  class="progress progress-primary w-full h-1.5"
                  :value="Math.min(avgIntervalMs / 3600000, m.minIntervalH)"
                  :max="m.minIntervalH"
                ></progress>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useLogStore }      from '../stores/log.js'
import { useProgressStore } from '../stores/progress.js'

const { hasEnoughData, avgIntervalMs } = storeToRefs(useLogStore())
const { habitTimeline } = storeToRefs(useProgressStore())
</script>
