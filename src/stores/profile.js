import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { calcHalfLife } from '../lib/pharmacokinetics.js'

const PROFILE_KEY = 'nicquitin-profile'

export const DEFAULT_PROFILE = {
  sex: 'male', metabolizer: 'normal',
  menthol: false, pregnant: false, contraceptives: false,
}

export const useProfileStore = defineStore('profile', () => {
  const profile = ref({ ...DEFAULT_PROFILE })

  const halfLifeH = computed(() => calcHalfLife(profile.value))

  function load() {
    const saved = localStorage.getItem(PROFILE_KEY)
    if (saved) profile.value = { ...DEFAULT_PROFILE, ...JSON.parse(saved) }
  }

  function save(p) {
    profile.value = { ...p }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
  }

  function importProfile(data) {
    profile.value = { ...DEFAULT_PROFILE, ...data }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
  }

  return { profile, halfLifeH, load, save, importProfile }
})
