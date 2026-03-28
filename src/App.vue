<template>
  <div class="min-h-screen bg-base-200 p-4 pb-10">
    <div class="max-w-xl mx-auto space-y-4">

      <!-- Header -->
      <div class="flex justify-between items-center pt-4 pb-2">
        <div>
          <h1 class="text-3xl font-bold">nicquitin</h1>
          <p class="text-base-content/60 text-sm">track your nicotine usage</p>
        </div>
        <button class="btn btn-ghost btn-circle" @click="showSettings = true">⚙️</button>
      </div>

      <NicotineCard />
      <BeatCard />
      <ActiveSessionsCard />
      <LogUsageCard />
      <PatternsCard />
      <HabitTimelineCard />
      <HistoryCard />

    </div>
  </div>

  <SettingsModal :show="showSettings" @close="showSettings = false" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

import { useTimeStore }     from './stores/time.js'
import { useLogStore }      from './stores/log.js'
import { useProfileStore }  from './stores/profile.js'
import { useProductsStore } from './stores/products.js'
import { useSessionsStore } from './stores/sessions.js'
import { useProgressStore } from './stores/progress.js'
import { useNicotineStore } from './stores/nicotine.js'

import NicotineCard      from './components/NicotineCard.vue'
import BeatCard          from './components/BeatCard.vue'
import ActiveSessionsCard from './components/ActiveSessionsCard.vue'
import LogUsageCard      from './components/LogUsageCard.vue'
import PatternsCard      from './components/PatternsCard.vue'
import HabitTimelineCard from './components/HabitTimelineCard.vue'
import HistoryCard       from './components/HistoryCard.vue'
import SettingsModal     from './components/SettingsModal.vue'

const showSettings = ref(false)

const timeStore     = useTimeStore()
const logStore      = useLogStore()
const profileStore  = useProfileStore()
const productsStore = useProductsStore()
const progressStore = useProgressStore()
const sessionsStore = useSessionsStore()
useNicotineStore()  // initialise so computed deps are wired up

onMounted(() => {
  timeStore.start()
  logStore.load()
  profileStore.load()
  productsStore.load()
  progressStore.load()
  sessionsStore.load()
})

onUnmounted(() => timeStore.stop())
</script>
