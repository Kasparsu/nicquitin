<template>
  <div class="card bg-base-100 shadow" v-if="log.length">
    <div class="card-body gap-2">
      <div class="flex justify-between items-center">
        <h2 class="card-title text-base">history</h2>
        <button class="btn btn-ghost btn-xs text-error" @click="clearAll">clear all</button>
      </div>
      <ul class="space-y-2">
        <li v-for="entry in log" :key="entry.id" class="flex items-center justify-between text-sm gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="shrink-0">{{ entry.emoji }}</span>
            <div class="truncate">
              <span class="font-medium">{{ entry.product }}</span>
              <span v-if="entry.puffs" class="text-base-content/50 text-xs ml-1">{{ entry.puffs }} puffs</span>
              <span v-if="entry.stoppedTs" class="text-base-content/40 text-xs ml-1">{{ formatDuration(entry.stoppedTs - entry.ts) }}</span>
              <span v-if="entry.reuseCount > 0" class="text-base-content/30 text-xs ml-1">reuse #{{ entry.reuseCount }}</span>
              <span v-if="entry.nicotineMg != null" class="text-base-content/40 text-xs ml-1">({{ entry.nicotineMg.toFixed(2) }}mg)</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-base-content/40 text-xs">{{ formatDateTime(entry.stoppedTs || entry.ts) }}</span>
            <button class="btn btn-ghost btn-xs text-error p-0 min-h-0 h-auto leading-none" @click="removeEntry(entry.id)">✕</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { formatDuration, formatDateTime } from '../lib/format.js'
import { useLogStore } from '../stores/log.js'

const logStore = useLogStore()
const { log } = storeToRefs(logStore)
const { removeEntry, clearAll } = logStore
</script>
