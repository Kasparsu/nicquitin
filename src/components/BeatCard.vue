<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-3 py-5">

      <!-- Level + streak row -->
      <div class="flex justify-between items-center min-h-[1.5rem]">
        <div class="flex items-center gap-2">
          <div class="badge badge-primary badge-sm">Lv.{{ level }}</div>
          <span class="text-xs text-base-content/50">
            {{ progressState.totalBeats }}
            <template v-if="progressState.totalAttempts > 0">/{{ progressState.totalAttempts }}</template>
            beats
          </span>
        </div>
        <div v-if="progressState.currentStreak >= 2" class="badge badge-warning badge-sm gap-1">
          🔥 {{ progressState.currentStreak }} streak
        </div>
      </div>

      <!-- Recent outcomes row -->
      <div v-if="recentOutcomes.length >= 3" class="flex items-center gap-1.5">
        <span class="text-[10px] text-base-content/40 shrink-0">last {{ recentOutcomes.length }}</span>
        <div class="flex gap-0.5">
          <span
            v-for="(hit, i) in recentOutcomes" :key="i"
            class="w-2 h-2 rounded-full"
            :class="hit ? 'bg-success' : 'bg-error/60'"
          ></span>
        </div>
        <span class="text-[10px] ml-auto" :class="recentDifficulty?.color">{{ recentDifficulty?.label }}</span>
      </div>

      <!-- Big timer -->
      <div class="text-center">
        <p class="text-base-content/50 text-sm">time since last use</p>
        <div v-if="lastHabitUsed" class="text-5xl font-mono font-bold tabular-nums my-1" :class="beatTimerColor">{{ elapsed }}</div>
        <div v-else class="text-base-content/30 text-sm py-4">no usage logged yet</div>
        <p v-if="lastHabitUsed" class="text-base-content/40 text-xs">
          {{ formatDateTime(lastHabitUsed.stoppedTs || lastHabitUsed.ts) }} &mdash; {{ lastHabitUsed.emoji }} {{ lastHabitUsed.product }}
          <span v-if="lastHabitUsed.puffs"> · {{ lastHabitUsed.puffs }} puffs</span>
        </p>
      </div>

      <!-- Beat progress bar -->
      <template v-if="lastHabitUsed && hasEnoughData">
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="text-base-content/50">target: wait {{ formatDuration(targetIntervalMs) }}</span>
            <span v-if="hasBeatenTarget" class="text-success font-semibold">🎉 target beaten!</span>
            <span v-else class="text-base-content/50">{{ timeToTarget }} to go</span>
          </div>
          <progress
            class="progress w-full h-2.5"
            :class="hasBeatenTarget ? 'progress-success' : beatProgress > 0.75 ? 'progress-warning' : 'progress-error'"
            :value="Math.min(beatProgress, 1)"
            max="1"
          ></progress>
        </div>
        <p v-if="hasBeatenTarget" class="text-xs text-base-content/40 text-center">
          next use will level up to Lv.{{ level + 1 }} · new target: {{ formatDuration(targetIntervalMs * (1 + BEAT_STEP)) }}
        </p>
      </template>
      <p v-else-if="lastHabitUsed" class="text-xs text-base-content/30 text-center">
        log {{ Math.max(0, MIN_ENTRIES_FOR_PATTERNS - log.length) }} more uses to unlock beat targets
      </p>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { formatDuration, formatDateTime } from '../lib/format.js'
import { useLogStore }      from '../stores/log.js'
import { useProgressStore, BEAT_STEP } from '../stores/progress.js'

const MIN_ENTRIES_FOR_PATTERNS = 5

const { log, lastHabitUsed, hasEnoughData } = storeToRefs(useLogStore())
const {
  progressState, level, recentOutcomes, recentDifficulty,
  targetIntervalMs, timeSinceLastMs, beatProgress, hasBeatenTarget, timeToTarget, beatTimerColor,
} = storeToRefs(useProgressStore())

const elapsed = computed(() => {
  if (!lastHabitUsed.value) return null
  const s   = Math.floor(timeSinceLastMs.value / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
  if (m > 0) return `${m}m ${String(sec).padStart(2,'0')}s`
  return `${sec}s`
})
</script>
