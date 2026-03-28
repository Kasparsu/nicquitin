import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useTimeStore = defineStore('time', () => {
  const now = ref(Date.now())
  let timer = null

  function start() { timer = setInterval(() => { now.value = Date.now() }, 1000) }
  function stop()  { if (timer) { clearInterval(timer); timer = null } }

  return { now, start, stop }
})
