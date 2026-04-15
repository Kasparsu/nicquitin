<template>
  <div class="min-h-screen bg-base-200 p-4 pb-24">
    <div class="max-w-xl mx-auto">

      <router-view />

    </div>
  </div>

  <!-- Bottom navigation -->
  <nav class="fixed bottom-0 inset-x-0 bg-base-100 border-t border-base-300 z-50">
    <div class="max-w-xl mx-auto flex">
      <router-link
        v-for="tab in navTabs" :key="tab.to"
        :to="tab.to"
        class="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors"
        :class="$route.name === tab.name
          ? 'text-primary'
          : 'text-base-content/40 hover:text-base-content/70'"
      >
        <span class="text-lg">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

import { useTimeStore }     from './stores/time.js'
import { useLogStore }      from './stores/log.js'
import { useProfileStore }  from './stores/profile.js'
import { useProductsStore } from './stores/products.js'
import { useSessionsStore } from './stores/sessions.js'
import { useProgressStore } from './stores/progress.js'
import { useNicotineStore } from './stores/nicotine.js'
import { useSyncStore }     from './stores/sync.js'
import { useTaperStore }      from './stores/taper.js'
import { useChallengesStore } from './stores/challenges.js'

const navTabs = [
  { to: '/',         name: 'home',     icon: '🏠', label: 'Home' },
  { to: '/log',      name: 'log',      icon: '📝', label: 'Log' },
  { to: '/taper',    name: 'taper',    icon: '📉', label: 'Taper' },
  { to: '/insights', name: 'insights', icon: '📊', label: 'Insights' },
  { to: '/history',  name: 'history',  icon: '📋', label: 'History' },
  { to: '/settings', name: 'settings', icon: '⚙️', label: 'Settings' },
]

const timeStore     = useTimeStore()
const logStore      = useLogStore()
const profileStore  = useProfileStore()
const productsStore = useProductsStore()
const progressStore = useProgressStore()
const sessionsStore = useSessionsStore()
const syncStore     = useSyncStore()
const taperStore      = useTaperStore()
const challengesStore = useChallengesStore()
useNicotineStore()

onMounted(() => {
  timeStore.start()
  logStore.load()
  profileStore.load()
  productsStore.load()
  progressStore.load()
  sessionsStore.load()
  syncStore.load()
  taperStore.load()
  challengesStore.load()
})

onUnmounted(() => timeStore.stop())
</script>
