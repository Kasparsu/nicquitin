import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useLogStore } from './log.js'

const PRODUCTS_KEY  = 'nicquitin-products'
const CARTRIDGE_KEY = 'nicquitin-cartridges'

export const DEFAULT_PRODUCTS = [
  { id: 'cigarette', name: 'Cigarette',    emoji: '🚬', nicotineMg: 1.1,  releaseType: 'instant', releaseDurationH: 0,   hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: true,  isNRT: false },
  { id: 'vape',      name: 'Vape',         emoji: '💨', nicotineMg: 0.1,  releaseType: 'instant', releaseDurationH: 0,   hasPuffCount: true,  useCartridgeCalc: true,  cartridgeNicotineMg: 20, cartridgeTotalPuffs: 200, hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: false },
  { id: 'pouch',     name: 'Pouch',        emoji: '🫙', nicotineMg: 3,    releaseType: 'slow',    releaseDurationH: 1,   hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: true,  hasSwallowOption: false, hasReuseOption: true,  producesCO: false, isNRT: false },
  { id: 'cigar',     name: 'Cigar',        emoji: '🍬', nicotineMg: 3,    releaseType: 'instant', releaseDurationH: 0,   hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: true,  isNRT: false },
]

// NRT product presets — based on Estonian (Apotheka) market availability
export const NRT_PRESETS = [
  // Nicorette Invisipatch (16h)
  { id: 'nicorette-25-16h',      name: 'Nicorette 25mg/16h',     emoji: '🩹', nicotineMg: 25,  releaseType: 'slow', releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-25-16h-half', name: 'Nicorette 25mg/16h (½)', emoji: '🩹', nicotineMg: 12.5, releaseType: 'slow', releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-15-16h',      name: 'Nicorette 15mg/16h',     emoji: '🩹', nicotineMg: 15,  releaseType: 'slow', releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-15-16h-half', name: 'Nicorette 15mg/16h (½)', emoji: '🩹', nicotineMg: 7.5, releaseType: 'slow', releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-10-16h',      name: 'Nicorette 10mg/16h',     emoji: '🩹', nicotineMg: 10,  releaseType: 'slow', releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-10-16h-half', name: 'Nicorette 10mg/16h (½)', emoji: '🩹', nicotineMg: 5,   releaseType: 'slow', releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  // NiQuitin TDP (24h)
  { id: 'niquitin-21-24h',       name: 'NiQuitin 21mg/24h',      emoji: '🟦', nicotineMg: 21,  releaseType: 'slow', releaseDurationH: 24,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-21-24h-half',  name: 'NiQuitin 21mg/24h (½)',  emoji: '🟦', nicotineMg: 10.5, releaseType: 'slow', releaseDurationH: 24,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-14-24h',       name: 'NiQuitin 14mg/24h',      emoji: '🟦', nicotineMg: 14,  releaseType: 'slow', releaseDurationH: 24,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-14-24h-half',  name: 'NiQuitin 14mg/24h (½)',  emoji: '🟦', nicotineMg: 7,   releaseType: 'slow', releaseDurationH: 24,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  // Nicorette Mouth Spray (1mg per spray, ~0.7mg absorbed buccally)
  { id: 'nicorette-spray-coolberry', name: 'Nicorette Coolberry Spray 1mg', emoji: '🌬️', nicotineMg: 0.7, releaseType: 'instant', releaseDurationH: 0, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-spray-coolmint', name: 'Nicorette Coolmint Spray 1mg', emoji: '🌬️', nicotineMg: 0.7, releaseType: 'instant', releaseDurationH: 0, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: false, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  // Gum (Nicorette — ~50% of labeled dose absorbed through buccal mucosa)
  { id: 'nicorette-gum-4mg',     name: 'Nicorette Gum 4mg',      emoji: '🟡', nicotineMg: 2,   releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true,  hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-gum-2mg',     name: 'Nicorette Gum 2mg',      emoji: '🟡', nicotineMg: 1,   releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true,  hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-gum-freshfruit-4mg', name: 'Nicorette Freshfruit Gum 4mg', emoji: '🟡', nicotineMg: 2, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-gum-freshfruit-2mg', name: 'Nicorette Freshfruit Gum 2mg', emoji: '🟡', nicotineMg: 1, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-gum-freshmint-4mg', name: 'Nicorette Freshmint Gum 4mg', emoji: '🟡', nicotineMg: 2, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'nicorette-gum-freshmint-2mg', name: 'Nicorette Freshmint Gum 2mg', emoji: '🟡', nicotineMg: 1, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true, hasReuseOption: false, producesCO: false, isNRT: true },
  // Gum (NiQuitin)
  { id: 'niquitin-gum-mint-4mg', name: 'NiQuitin Mint Gum 4mg',  emoji: '🟡', nicotineMg: 2,   releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true,  hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-gum-mint-2mg', name: 'NiQuitin Mint Gum 2mg',  emoji: '🟡', nicotineMg: 1,   releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: true,  hasReuseOption: false, producesCO: false, isNRT: true },
  // Lozenges
  { id: 'niquitin-lozenge-4mg',  name: 'NiQuitin Lozenge 4mg',   emoji: '🔵', nicotineMg: 4,   releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-lozenge-2mg',  name: 'NiQuitin Lozenge 2mg',   emoji: '🔵', nicotineMg: 2,   releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-mini-4mg',     name: 'NiQuitin Mini Lozenge 4mg', emoji: '🔵', nicotineMg: 4, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
  { id: 'niquitin-mini-mint-2mg', name: 'NiQuitin Mini Mint Lozenge 2mg', emoji: '🔵', nicotineMg: 2, releaseType: 'slow', releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0, cartridgeTotalPuffs: 0, hasSession: true, hasSwallowOption: false, hasReuseOption: false, producesCO: false, isNRT: true },
]

export const useProductsStore = defineStore('products', () => {
  const log = useLogStore()

  const products          = ref([])
  const cartridgeSessions = ref({})

  function productById(id) {
    return products.value.find(p => p.id === id) ?? null
  }

  function puffsUsed(productId) {
    const session = cartridgeSessions.value[productId]
    if (!session) return 0
    return log.log
      .filter(e => e.productId === productId && e.puffs != null && e.ts >= session.startTs)
      .reduce((sum, e) => sum + e.puffs, 0)
  }

  function puffsRemaining(productId) {
    const session = cartridgeSessions.value[productId]
    if (!session) return 0
    return Math.max(0, session.totalPuffs - puffsUsed(productId))
  }

  function cartridgePct(productId) {
    const session = cartridgeSessions.value[productId]
    if (!session || session.totalPuffs === 0) return 100
    return Math.round((puffsRemaining(productId) / session.totalPuffs) * 100)
  }

  function newCartridge(productId) {
    const p = productById(productId)
    if (!p) return
    cartridgeSessions.value = {
      ...cartridgeSessions.value,
      [productId]: { startTs: Date.now(), totalPuffs: p.cartridgeTotalPuffs || 200 },
    }
    localStorage.setItem(CARTRIDGE_KEY, JSON.stringify(cartridgeSessions.value))
  }

  function applyRefill(productId, newEstimate) {
    const p = productById(productId)
    if (p && newEstimate > 0) {
      p.cartridgeTotalPuffs = newEstimate
      if (p.useCartridgeCalc && p.cartridgeNicotineMg > 0) {
        p.nicotineMg = parseFloat((p.cartridgeNicotineMg / newEstimate).toFixed(6))
      }
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.value))
    }
    newCartridge(productId)
  }

  function load() {
    const savedProducts = localStorage.getItem(PRODUCTS_KEY)
    if (savedProducts) {
      const saved = JSON.parse(savedProducts)
      products.value = saved.map(sp => {
        const def = DEFAULT_PRODUCTS.find(d => d.id === sp.id)
        const base = def ? { ...def, ...sp } : sp
        return {
          producesCO: false, hasSession: false,
          hasSwallowOption: false, hasReuseOption: false,
          isNRT: false,
          ...base,
        }
      })
    } else {
      products.value = DEFAULT_PRODUCTS.map(p => ({ ...p }))
    }
    const savedCartridges = localStorage.getItem(CARTRIDGE_KEY)
    if (savedCartridges) cartridgeSessions.value = JSON.parse(savedCartridges)
  }

  function saveProducts(list) {
    products.value = list.map(p =>
      p.hasPuffCount && p.useCartridgeCalc && p.cartridgeTotalPuffs > 0
        ? { ...p, nicotineMg: p.cartridgeNicotineMg / p.cartridgeTotalPuffs }
        : p
    )
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.value))
  }

  function importProducts(data) {
    products.value = data
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.value))
  }

  function importCartridges(data) {
    cartridgeSessions.value = data
    localStorage.setItem(CARTRIDGE_KEY, JSON.stringify(cartridgeSessions.value))
  }

  return {
    products, cartridgeSessions,
    productById, puffsUsed, puffsRemaining, cartridgePct,
    newCartridge, applyRefill,
    load, saveProducts, importProducts, importCartridges,
  }
})
