<template>
  <div v-if="show" class="modal modal-open">
    <div class="modal-box w-full max-w-lg">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">configure</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="close">✕</button>
      </div>

      <!-- Profile -->
      <div class="bg-base-200 rounded-xl px-4 py-3 space-y-3 mb-3">
        <div class="text-xs font-semibold text-base-content/50 uppercase tracking-wide">metabolism profile</div>
        <div class="grid grid-cols-2 gap-2">
          <label class="form-control">
            <div class="label py-0.5"><span class="label-text text-xs">biological sex</span></div>
            <select class="select select-sm select-bordered" v-model="editableProfile.sex">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label class="form-control">
            <div class="label py-0.5"><span class="label-text text-xs">CYP2A6 metabolizer</span></div>
            <select class="select select-sm select-bordered" v-model="editableProfile.metabolizer">
              <option value="slow">Slow (~3.5h t½)</option>
              <option value="normal">Normal (~2h t½)</option>
              <option value="fast">Fast (~1.4h t½)</option>
            </select>
          </label>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" v-model="editableProfile.menthol" />
            <span class="text-sm">Menthol products</span>
          </label>
          <label v-if="editableProfile.sex === 'female'" class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" v-model="editableProfile.pregnant" />
            <span class="text-sm">Pregnant</span>
          </label>
          <label v-if="editableProfile.sex === 'female' && !editableProfile.pregnant" class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="checkbox checkbox-sm" v-model="editableProfile.contraceptives" />
            <span class="text-sm">Hormonal contraceptives</span>
          </label>
        </div>
        <div class="bg-base-100 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
          <span class="text-base-content/50">adjusted half-life</span>
          <span class="font-mono font-bold">{{ previewHalfLifeH.toFixed(2) }} h</span>
        </div>
      </div>

      <div class="divider text-xs my-0">products</div>

      <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1 mt-2">
        <div v-for="p in editableProducts" :key="p.id" class="bg-base-200 rounded-xl">
          <div class="flex items-center justify-between px-4 py-3 cursor-pointer select-none" @click="toggleExpanded(p.id)">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ p.emoji }}</span>
              <span class="font-medium text-sm">{{ p.name }}</span>
              <span class="text-xs text-base-content/40">
                {{ p.nicotineMg.toFixed(3) }}mg{{ p.hasPuffCount ? '/puff' : '' }}
                · {{ p.releaseType === 'slow' ? `slow (${p.releaseDurationH}h)` : 'instant' }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-base-content/40 text-xs">{{ expandedProduct === p.id ? '▲' : '▼' }}</span>
              <button class="btn btn-ghost btn-xs text-error ml-1" @click.stop="deleteProduct(p.id)">✕</button>
            </div>
          </div>
          <div v-if="expandedProduct === p.id" class="px-4 pb-4 space-y-2 border-t border-base-300 pt-3">
            <div class="grid grid-cols-2 gap-2">
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">name</span></div>
                <input class="input input-sm input-bordered" v-model="p.name" />
              </label>
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">emoji</span></div>
                <input class="input input-sm input-bordered" v-model="p.emoji" />
              </label>
            </div>
            <label class="form-control">
              <div class="label py-0.5"><span class="label-text text-xs">release type</span></div>
              <select class="select select-sm select-bordered" v-model="p.releaseType">
                <option value="instant">instant (cigarettes, vapes)</option>
                <option value="slow">slow release (patches, gum, pouches)</option>
              </select>
            </label>
            <label v-if="p.releaseType === 'slow'" class="form-control">
              <div class="label py-0.5"><span class="label-text text-xs">release duration (hours)</span></div>
              <input class="input input-sm input-bordered" type="number" min="0.1" step="0.1" v-model.number="p.releaseDurationH" />
            </label>
            <div class="flex items-center gap-2 pt-1">
              <input type="checkbox" class="checkbox checkbox-sm" :id="'pc-' + p.id" v-model="p.hasPuffCount" />
              <label :for="'pc-' + p.id" class="text-sm cursor-pointer">track puff count</label>
            </div>
            <template v-if="p.hasPuffCount">
              <div class="divider text-xs my-1">cartridge / pod calculator</div>
              <div class="flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-sm" :id="'cc-' + p.id" v-model="p.useCartridgeCalc" />
                <label :for="'cc-' + p.id" class="text-sm cursor-pointer">calculate mg/puff from cartridge</label>
              </div>
              <template v-if="p.useCartridgeCalc">
                <div class="grid grid-cols-2 gap-2">
                  <label class="form-control">
                    <div class="label py-0.5"><span class="label-text text-xs">cartridge nicotine (mg)</span></div>
                    <input class="input input-sm input-bordered" type="number" min="0.1" step="0.1" v-model.number="p.cartridgeNicotineMg" />
                  </label>
                  <label class="form-control">
                    <div class="label py-0.5"><span class="label-text text-xs">estimated puff count</span></div>
                    <input class="input input-sm input-bordered" type="number" min="1" step="1" v-model.number="p.cartridgeTotalPuffs" />
                  </label>
                </div>
                <div class="bg-base-100 rounded-lg px-3 py-2 text-sm flex justify-between items-center">
                  <span class="text-base-content/60">mg per puff</span>
                  <span class="font-mono font-bold">{{ p.cartridgeTotalPuffs > 0 ? (p.cartridgeNicotineMg / p.cartridgeTotalPuffs).toFixed(4) : '—' }} mg</span>
                </div>
              </template>
              <template v-else>
                <label class="form-control">
                  <div class="label py-0.5"><span class="label-text text-xs">nicotine per puff (mg)</span></div>
                  <input class="input input-sm input-bordered" type="number" min="0.001" step="0.001" v-model.number="p.nicotineMg" />
                </label>
              </template>
            </template>
            <template v-else>
              <label class="form-control">
                <div class="label py-0.5"><span class="label-text text-xs">nicotine per use (mg)</span></div>
                <input class="input input-sm input-bordered" type="number" min="0.01" step="0.01" v-model.number="p.nicotineMg" />
              </label>
            </template>
          </div>
        </div>
      </div>

      <button class="btn btn-outline btn-sm w-full mt-3" @click="addProduct">+ add product</button>

      <!-- Import / Export -->
      <div class="divider text-xs my-2">data</div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm flex-1" @click="exportData">⬇ export</button>
        <label class="btn btn-outline btn-sm flex-1 cursor-pointer">
          ⬆ import
          <input type="file" class="hidden" accept=".json" @change="handleImport" />
        </label>
      </div>
      <div v-if="importStatus === 'success'" class="text-xs text-success text-center mt-1">
        ✓ data imported successfully
      </div>
      <div v-if="importStatus === 'error'" class="text-xs text-error text-center mt-1">
        ✗ {{ importError }}
      </div>

      <div class="modal-action mt-4">
        <button class="btn btn-primary" @click="save">save</button>
        <button class="btn btn-ghost" @click="close">cancel</button>
      </div>
    </div>
    <label class="modal-backdrop" @click="close"></label>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { calcHalfLife } from '../lib/pharmacokinetics.js'
import { useLogStore }      from '../stores/log.js'
import { useProfileStore }  from '../stores/profile.js'
import { useProductsStore } from '../stores/products.js'
import { useSessionsStore } from '../stores/sessions.js'
import { useProgressStore } from '../stores/progress.js'

const props  = defineProps({ show: Boolean })
const emit   = defineEmits(['close'])

const logStore      = useLogStore()
const profileStore  = useProfileStore()
const productsStore = useProductsStore()
const sessionsStore = useSessionsStore()
const progressStore = useProgressStore()

const { profile }  = storeToRefs(profileStore)
const { products, cartridgeSessions } = storeToRefs(productsStore)
const { activeSessions, pouchSessions } = storeToRefs(sessionsStore)
const { progressState } = storeToRefs(progressStore)
const { log } = storeToRefs(logStore)

// ─── Editable copies (initialised when modal opens) ───────────────────────────

const editableProducts = ref([])
const editableProfile  = ref({})
const expandedProduct  = ref(null)
const importStatus     = ref(null)
const importError      = ref('')

watch(() => props.show, (val) => {
  if (val) {
    editableProducts.value = products.value.map(p => ({ ...p }))
    editableProfile.value  = { ...profile.value }
    expandedProduct.value  = null
    importStatus.value     = null
  }
})

const previewHalfLifeH = computed(() => calcHalfLife(editableProfile.value))

// ─── Actions ─────────────────────────────────────────────────────────────────

function close() { emit('close') }

function save() {
  productsStore.saveProducts(editableProducts.value)
  profileStore.save(editableProfile.value)
  emit('close')
}

function toggleExpanded(id) { expandedProduct.value = expandedProduct.value === id ? null : id }

function deleteProduct(id) {
  editableProducts.value = editableProducts.value.filter(p => p.id !== id)
  if (expandedProduct.value === id) expandedProduct.value = null
}

function addProduct() {
  const id = `custom-${Date.now()}`
  editableProducts.value.push({ id, name: 'New Product', emoji: '🟣', nicotineMg: 1, releaseType: 'instant', releaseDurationH: 1, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0 })
  expandedProduct.value = id
}

// ─── Import / Export ──────────────────────────────────────────────────────────

function exportData() {
  const payload = {
    version:       1,
    exported:      new Date().toISOString(),
    log:           log.value,
    products:      products.value,
    cartridges:    cartridgeSessions.value,
    sessions:      activeSessions.value,
    pouchSessions: pouchSessions.value,
    profile:       profile.value,
    progress:      progressState.value,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `niczero-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImport(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (!data.version || !Array.isArray(data.log)) throw new Error('unrecognised file format')

      if (data.log)           logStore.importLog(data.log)
      if (data.products)      productsStore.importProducts(data.products)
      if (data.cartridges)    productsStore.importCartridges(data.cartridges)
      if (data.sessions)      sessionsStore.importSessions(data.sessions)
      if (data.pouchSessions) sessionsStore.importPouchSessions(data.pouchSessions)
      if (data.profile)       profileStore.importProfile(data.profile)
      if (data.progress)      progressStore.importProgress(data.progress)

      editableProducts.value = products.value.map(p => ({ ...p }))
      editableProfile.value  = { ...profile.value }
      importStatus.value = 'success'
    } catch (err) {
      importError.value  = err.message ?? 'invalid file'
      importStatus.value = 'error'
    }
  }
  reader.readAsText(file)
}
</script>
