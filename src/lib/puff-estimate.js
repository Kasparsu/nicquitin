// Personalized puff count estimation model.
// Adjusts manufacturer puff claims based on user biometrics and puff style.
// Falls back gracefully when data is missing.

const MACHINE_PUFF_ML = 55      // ISO machine test puff volume (ml)
const CONSERVATIVE_MULT = 0.90   // bias toward higher mg/puff (fewer puffs)
const MIN_RATIO = 0.50           // floor: never below 50% of manufacturer claim

// Base puff volumes by style (ml per puff, MTL devices)
const PUFF_VOLUME_ML = { light: 45, normal: 70, deep: 120 }

// Population-average vital capacity (ml) — slightly above true mean for conservative bias
const AVG_VC_ML = { male: 4800, female: 3700 }

export const PUFF_STYLES = [
  { value: 'light', label: 'Light / short puffs' },
  { value: 'normal', label: 'Normal' },
  { value: 'deep', label: 'Deep / long draws' },
]

/**
 * Estimate vital capacity (ml) using Quanjer ERS spirometry equations.
 * Returns null if height or age is missing.
 */
function estimateVitalCapacityMl(sex, heightCm, age) {
  if (!heightCm || !age) return null
  const vc = sex === 'female'
    ? 0.0443 * heightCm - 0.026 * age - 2.89
    : 0.0576 * heightCm - 0.026 * age - 4.34
  return Math.max(vc * 1000, 1500) // convert L→ml, floor at 1.5L
}

/**
 * Estimate the user's puff volume (ml) based on puff style and optional biometrics.
 * When biometrics are available, scales by sqrt(userVC / avgVC) to dampen
 * the effect — puff volume is voluntary behavior, not purely lung-limited.
 */
function estimatePuffVolumeMl(profile) {
  const style = profile.puffStyle
  if (!style || !PUFF_VOLUME_ML[style]) return null

  const baseMl = PUFF_VOLUME_ML[style]
  const sex = profile.sex || 'male'

  const userVC = estimateVitalCapacityMl(sex, profile.heightCm, profile.age)
  if (!userVC) return baseMl // no biometrics → use base volume

  const avgVC = AVG_VC_ML[sex]
  const scale = Math.sqrt(userVC / avgVC)
  return baseMl * scale
}

/**
 * Main entry point. Returns adjusted puff count for a catalog product.
 *
 * @param {{ volumeMl: number, estPuffs: number }} product - catalog product fields
 * @param {{ sex?: string, age?: number, heightCm?: number, weightKg?: number, puffStyle?: string }} profile
 * @returns {number} adjusted puff count (integer)
 */
export function estimatePuffs(product, profile) {
  if (!product || !product.estPuffs) return 0

  // Default to 'deep' puff style when not set — assume absolute worst case
  const effectiveProfile = {
    sex: 'male',
    ...profile,
    puffStyle: profile?.puffStyle || 'deep',
  }

  const userPuffMl = estimatePuffVolumeMl(effectiveProfile)
  if (!userPuffMl) return product.estPuffs

  const ratio = MACHINE_PUFF_ML / userPuffMl
  const adjusted = Math.round(product.estPuffs * ratio * CONSERVATIVE_MULT)
  const floor = Math.round(product.estPuffs * MIN_RATIO)

  return Math.max(adjusted, floor)
}
