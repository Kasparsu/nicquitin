<template>
  <dialog ref="dialog" class="modal" @close="onClose">
    <div class="modal-box max-w-sm">
      <h3 class="font-bold text-lg">{{ state.title }}</h3>
      <p class="py-4 text-base-content/70">{{ state.message }}</p>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm" @click="cancel">cancel</button>
        <button class="btn btn-sm" :class="state.destructive ? 'btn-error' : 'btn-primary'" @click="ok">{{ state.confirmLabel }}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'

const dialog = ref(null)
const state = reactive({ title: '', message: '', confirmLabel: 'confirm', destructive: true })
let _resolve = null

function show(opts = {}) {
  state.title = opts.title ?? 'Are you sure?'
  state.message = opts.message ?? ''
  state.confirmLabel = opts.confirmLabel ?? 'confirm'
  state.destructive = opts.destructive ?? true
  return new Promise(resolve => {
    _resolve = resolve
    try { dialog.value?.showModal() } catch { dialog.value?.setAttribute('open', '') }
  })
}

function closeDialog() {
  try { dialog.value?.close() } catch { dialog.value?.removeAttribute('open') }
}

function ok() {
  _resolve?.(true)
  _resolve = null
  closeDialog()
}

function cancel() {
  _resolve?.(false)
  _resolve = null
  closeDialog()
}

function onClose() {
  if (_resolve) {
    _resolve(false)
    _resolve = null
  }
}

defineExpose({ show })
</script>
