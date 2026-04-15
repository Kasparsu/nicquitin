<template>
  <div class="card bg-base-100 shadow" v-if="log.length">
    <div class="card-body gap-2">
      <div class="flex justify-between items-center">
        <h2 class="card-title text-base">history</h2>
        <button class="btn btn-ghost btn-xs text-error" @click="clearAll">clear all</button>
      </div>
      <ul class="space-y-2">
        <li v-for="entry in log" :key="entry.id">
          <!-- Editing -->
          <div v-if="editing?.id === entry.id" class="bg-base-200 rounded-xl px-3 py-3 space-y-2">
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
            <label v-if="entry.puffs != null" class="form-control">
              <div class="label py-0.5"><span class="label-text text-xs">puffs</span></div>
              <input type="number" class="input input-sm input-bordered font-mono" min="1" step="1" v-model.number="editing.puffs" />
            </label>
            <label v-if="entry.stoppedTs" class="form-control">
              <div class="label py-0.5"><span class="label-text text-xs">stopped</span></div>
              <input type="datetime-local" class="input input-sm input-bordered font-mono text-xs" v-model="editing.stoppedDatetime" />
            </label>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-xs flex-1" @click="saveEdit">save</button>
              <button class="btn btn-ghost btn-xs" @click="editing = null">cancel</button>
            </div>
          </div>

          <!-- Display -->
          <div v-else class="flex items-center justify-between text-sm gap-2">
            <div class="flex items-center gap-2 min-w-0 cursor-pointer" @click="startEdit(entry)">
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
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { formatDuration, formatDateTime } from '../lib/format.js'
import { useLogStore } from '../stores/log.js'

const logStore = useLogStore()
const { log } = storeToRefs(logStore)
const { removeEntry, clearAll, updateEntry } = logStore

const editing = ref(null)

function toLocalDatetime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function startEdit(entry) {
  editing.value = {
    id: entry.id,
    datetime: toLocalDatetime(entry.ts),
    stoppedDatetime: entry.stoppedTs ? toLocalDatetime(entry.stoppedTs) : null,
    nicotineMg: entry.nicotineMg,
    puffs: entry.puffs,
  }
}

function saveEdit() {
  if (!editing.value) return
  const fields = {
    ts: new Date(editing.value.datetime).getTime(),
    nicotineMg: editing.value.nicotineMg,
  }
  if (editing.value.puffs != null) fields.puffs = editing.value.puffs
  if (editing.value.stoppedDatetime) fields.stoppedTs = new Date(editing.value.stoppedDatetime).getTime()
  updateEntry(editing.value.id, fields)
  editing.value = null
}
</script>
