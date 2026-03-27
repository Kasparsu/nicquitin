<template>
  <div class="min-h-screen bg-base-200 p-4 pb-10">
    <div class="max-w-xl mx-auto space-y-4">

      <!-- Header -->
      <div class="flex justify-between items-center pt-4 pb-2">
        <div>
          <h1 class="text-3xl font-bold">nicquitin</h1>
          <p class="text-base-content/60 text-sm">track your nicotine usage</p>
        </div>
        <button class="btn btn-ghost btn-circle" @click="openSettings">⚙️</button>
      </div>

      <!-- Nicotine Level Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">nicotine in body</h2>
          <div>
            <progress class="progress w-full h-3" :class="gaugeColor"
              :value="Math.min(nicotineLevel, GAUGE_MAX)" :max="GAUGE_MAX"></progress>
            <div class="flex justify-between mt-1 text-xs text-base-content/40">
              <span>0 mg</span><span>{{ GAUGE_MAX }} mg</span>
            </div>
          </div>
          <div class="flex items-end justify-between">
            <div>
              <span class="text-4xl font-mono font-bold tabular-nums">{{ nicotineLevel.toFixed(2) }}</span>
              <span class="text-sm text-base-content/50 ml-1">mg estimated</span>
            </div>
            <div class="text-right text-sm">
              <div v-if="nicotineLevel > CLEAN_THRESHOLD" class="text-base-content/60">
                clean in <span class="font-semibold">~{{ timeUntilClean }}</span>
              </div>
              <div v-else class="text-success font-semibold">nicotine free ✓</div>
              <div class="text-xs text-base-content/30 mt-0.5">t½ = {{ halfLifeH }}h</div>
            </div>
          </div>
          <div class="divider text-xs my-0">recovery milestones</div>
          <div v-if="lastUsed" class="space-y-2">
            <div v-for="m in milestones" :key="m.label" class="flex items-center gap-2 text-sm">
              <span class="shrink-0 w-5 text-center">{{ m.achieved ? '✅' : '🔘' }}</span>
              <span class="flex-1 leading-tight" :class="m.achieved ? 'text-success' : 'text-base-content/70'">{{ m.label }}</span>
              <span class="text-xs text-base-content/50 shrink-0">{{ m.achieved ? m.ago : 'in ' + m.remaining }}</span>
            </div>
          </div>
          <div v-else class="text-center text-base-content/40 text-sm py-2">log usage to see milestones</div>
        </div>
      </div>

      <!-- Beat the Timer Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body gap-3 py-5">

          <!-- Level + streak row -->
          <div class="flex justify-between items-center min-h-[1.5rem]">
            <div class="flex items-center gap-2">
              <div class="badge badge-primary badge-sm">Lv.{{ level }}</div>
              <span class="text-xs text-base-content/50">
                {{ progressState.totalBeats }}
                <template v-if="progressState.totalAttempts > 0">/{{ progressState.totalAttempts }}</template>
                beats
              </span>
            </div>
            <div v-if="progressState.currentStreak >= 2" class="badge badge-warning badge-sm gap-1">
              🔥 {{ progressState.currentStreak }} streak
            </div>
          </div>

          <!-- Recent outcomes row -->
          <div v-if="recentOutcomes.length >= 3" class="flex items-center gap-1.5">
            <span class="text-[10px] text-base-content/40 shrink-0">last {{ recentOutcomes.length }}</span>
            <div class="flex gap-0.5">
              <span
                v-for="(hit, i) in recentOutcomes" :key="i"
                class="w-2 h-2 rounded-full"
                :class="hit ? 'bg-success' : 'bg-error/60'"
              ></span>
            </div>
            <span class="text-[10px] ml-auto" :class="recentDifficulty?.color">{{ recentDifficulty?.label }}</span>
          </div>

          <!-- Big timer -->
          <div class="text-center">
            <p class="text-base-content/50 text-sm">time since last use</p>
            <div v-if="lastUsed" class="text-5xl font-mono font-bold tabular-nums my-1" :class="beatTimerColor">{{ elapsed }}</div>
            <div v-else class="text-base-content/30 text-sm py-4">no usage logged yet</div>
            <p v-if="lastUsed" class="text-base-content/40 text-xs">
              {{ formatDateTime(lastUsed.stoppedTs || lastUsed.ts) }} &mdash; {{ lastUsed.emoji }} {{ lastUsed.product }}
              <span v-if="lastUsed.puffs"> · {{ lastUsed.puffs }} puffs</span>
            </p>
          </div>

          <!-- Beat progress bar -->
          <template v-if="lastUsed && hasEnoughData">
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-base-content/50">target: wait {{ formatDuration(targetIntervalMs) }}</span>
                <span v-if="hasBeatenTarget" class="text-success font-semibold">🎉 target beaten!</span>
                <span v-else class="text-base-content/50">{{ timeToTarget }} to go</span>
              </div>
              <progress
                class="progress w-full h-2.5"
                :class="hasBeatenTarget ? 'progress-success' : beatProgress > 0.75 ? 'progress-warning' : 'progress-error'"
                :value="Math.min(beatProgress, 1)"
                max="1"
              ></progress>
            </div>
            <p v-if="hasBeatenTarget" class="text-xs text-base-content/40 text-center">
              next use will level up to Lv.{{ level + 1 }} · new target: {{ formatDuration(targetIntervalMs * (1 + BEAT_STEP)) }}
            </p>
          </template>
          <p v-else-if="lastUsed" class="text-xs text-base-content/30 text-center">
            log {{ Math.max(0, MIN_ENTRIES_FOR_PATTERNS - log.length) }} more uses to unlock beat targets
          </p>

        </div>
      </div>

      <!-- Log Usage Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">log usage</h2>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in products" :key="p.id"
              class="btn btn-outline btn-sm flex-col h-auto py-3 gap-0.5"
              :class="[
                pendingProduct?.id === p.id || (p.hasSession && activeSessions[p.id]) ? 'btn-primary border-primary' : '',
              ]"
              @click="selectProduct(p)"
            >
              <span class="text-xl">{{ p.emoji }}</span>
              <span class="text-xs leading-tight">{{ p.name }}</span>
              <span class="text-[10px] text-base-content/40">
                {{ p.nicotineMg.toFixed(3) }}mg{{ p.hasPuffCount ? '/puff' : '' }}
              </span>
              <span v-if="p.hasSession && activeSessions[p.id]" class="text-[10px] text-primary font-mono">
                ⏱ {{ sessionElapsedShort(p.id) }}
              </span>
              <span v-else-if="p.hasSession" class="text-[10px] text-base-content/30">tap to start</span>
              <span
                v-else-if="p.hasPuffCount && cartridgeSessions[p.id]"
                class="text-[10px]"
                :class="cartridgePct(p.id) < 20 ? 'text-error' : 'text-base-content/40'"
              >{{ puffsRemaining(p.id) }} left</span>
            </button>
          </div>

          <!-- Session stop panel (patch / gum / pouch) -->
          <div v-if="pendingProduct?.hasSession && activeSessions[pendingProduct.id]" class="bg-base-200 rounded-xl p-4 space-y-3">
            <div class="text-center">
              <div class="text-2xl font-mono font-bold tabular-nums">{{ sessionElapsed(pendingProduct.id) }}</div>
              <div class="text-xs text-base-content/50 mt-0.5">{{ pendingProduct.emoji }} {{ pendingProduct.name }} in use</div>
              <div v-if="activeSessions[pendingProduct.id].reuseCount > 0" class="text-xs text-warning mt-1">
                reuse #{{ activeSessions[pendingProduct.id].reuseCount }}
                · ~{{ (pendingProduct.nicotineMg * Math.pow(0.5, activeSessions[pendingProduct.id].reuseCount)).toFixed(2) }}mg available
              </div>
            </div>
            <!-- Gum: spit vs swallow -->
            <template v-if="pendingProduct.hasSwallowOption">
              <div class="flex gap-2">
                <button class="btn btn-outline btn-sm flex-1" @click="stopSession(pendingProduct.id, { swallowed: false })">🚮 spit out</button>
                <button class="btn btn-primary btn-sm flex-1" @click="stopSession(pendingProduct.id, { swallowed: true })">⬇ swallow</button>
              </div>
            </template>
            <!-- Pouch: done vs reuse -->
            <template v-else-if="pendingProduct.hasReuseOption">
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm flex-1" @click="stopSession(pendingProduct.id)">✓ remove, done</button>
                <button class="btn btn-outline btn-sm flex-1" @click="reusePouch(pendingProduct.id)">↩ put back</button>
              </div>
            </template>
            <!-- Patch (or other): just remove -->
            <template v-else>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm flex-1" @click="stopSession(pendingProduct.id)">remove {{ pendingProduct.emoji }}</button>
              </div>
            </template>
            <button class="btn btn-ghost btn-sm w-full" @click="pendingProduct = null">cancel</button>
          </div>

          <!-- Puff count + cartridge panel -->
          <div v-if="pendingProduct?.hasPuffCount" class="bg-base-200 rounded-xl p-4 space-y-3">

            <!-- Active cartridge stats -->
            <div v-if="cartridgeSessions[pendingProduct.id] && !refillConfirm" class="space-y-1.5">
              <div class="flex justify-between items-center text-xs text-base-content/60">
                <span>{{ pendingProduct.emoji }} cartridge</span>
                <span
                  :class="puffsUsed(pendingProduct.id) > cartridgeSessions[pendingProduct.id].totalPuffs ? 'text-warning' : ''"
                >{{ puffsUsed(pendingProduct.id) }} / {{ cartridgeSessions[pendingProduct.id].totalPuffs }} puffs</span>
              </div>
              <progress
                class="progress w-full h-2"
                :class="puffsUsed(pendingProduct.id) > cartridgeSessions[pendingProduct.id].totalPuffs ? 'progress-warning' : cartridgePct(pendingProduct.id) < 20 ? 'progress-error' : 'progress-info'"
                :value="puffsUsed(pendingProduct.id)"
                :max="cartridgeSessions[pendingProduct.id].totalPuffs"
              ></progress>
              <div class="flex justify-between text-xs">
                <span class="text-base-content/50">
                  {{ (puffsUsed(pendingProduct.id) * pendingProduct.nicotineMg).toFixed(2) }}mg consumed
                  · {{ pendingProduct.nicotineMg.toFixed(4) }}mg/puff
                </span>
                <button class="text-primary underline underline-offset-2" @click="initiateRefill(pendingProduct.id)">refill</button>
              </div>
            </div>

            <!-- No session yet -->
            <div v-else-if="!cartridgeSessions[pendingProduct.id] && !refillConfirm" class="flex justify-between items-center text-xs text-base-content/50">
              <span>no cartridge session</span>
              <button class="text-primary underline underline-offset-2" @click="newCartridge(pendingProduct.id)">start tracking</button>
            </div>

            <!-- Refill confirmation -->
            <div v-if="refillConfirm" class="bg-base-100 rounded-xl p-3 space-y-2.5 border border-primary/30">
              <p class="text-sm font-semibold">refill summary</p>
              <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-base-content/60">
                <span>puffs this session</span>
                <span class="font-mono font-medium text-base-content">{{ refillConfirm.actualPuffs }}</span>
                <span>cartridge nicotine</span>
                <span class="font-mono font-medium text-base-content">{{ refillConfirm.nicotineMg.toFixed(1) }}mg</span>
                <span>actual mg/puff</span>
                <span class="font-mono font-medium text-base-content">
                  {{ refillConfirm.actualPuffs > 0 ? (refillConfirm.nicotineMg / refillConfirm.actualPuffs).toFixed(4) : '—' }}mg
                </span>
              </div>
              <label class="form-control">
                <div class="label py-0.5">
                  <span class="label-text text-xs">update puff estimate for next refill</span>
                </div>
                <input
                  class="input input-sm input-bordered font-mono"
                  type="number" min="1" step="1"
                  v-model.number="refillConfirm.newEstimate"
                />
                <div class="label py-0.5">
                  <span class="label-text-alt text-xs text-base-content/40">
                    → {{ refillConfirm.newEstimate > 0 ? (refillConfirm.nicotineMg / refillConfirm.newEstimate).toFixed(4) : '—' }}mg/puff next session
                  </span>
                </div>
              </label>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm flex-1" @click="confirmRefill(pendingProduct.id)">confirm refill</button>
                <button class="btn btn-ghost btn-sm" @click="refillConfirm = null">cancel</button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <button class="btn btn-sm btn-circle btn-ghost text-xl font-bold" @click="puffCount = Math.max(1, puffCount - 1)">−</button>
              <div class="flex-1 text-center">
                <div class="text-3xl font-bold font-mono tabular-nums">{{ puffCount }}</div>
                <div class="text-xs text-base-content/50">puffs &mdash; {{ (puffCount * pendingProduct.nicotineMg).toFixed(2) }}mg</div>
              </div>
              <button class="btn btn-sm btn-circle btn-ghost text-xl font-bold" @click="puffCount++">+</button>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm flex-1" @click="confirmLog">log {{ puffCount }} puffs</button>
              <button class="btn btn-ghost btn-sm" @click="pendingProduct = null">cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Patterns Card -->
      <div class="card bg-base-100 shadow" v-if="hasEnoughData">
        <div class="card-body gap-3">
          <h2 class="card-title text-base">patterns</h2>

          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-sm font-bold font-mono">{{ formatDuration(avgIntervalMs) }}</div>
              <div class="text-[10px] text-base-content/50 mt-0.5">avg interval</div>
            </div>
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-sm font-bold font-mono">{{ usesPerDay7d.toFixed(1) }}<span class="text-xs font-normal">/day</span></div>
              <div class="text-[10px] text-base-content/50 mt-0.5">frequency</div>
            </div>
            <div class="bg-base-200 rounded-lg p-2">
              <div class="text-sm font-bold" :class="trendColor">{{ trendLabel }}</div>
              <div class="text-[10px] text-base-content/50 mt-0.5">7-day trend</div>
            </div>
          </div>

          <div v-if="peakHours.length" class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-base-content/40">peak times</span>
            <span v-for="ph in peakHours" :key="ph.label" class="badge badge-ghost badge-sm">{{ ph.label }}</span>
            <span class="text-xs text-base-content/30 ml-auto">based on {{ log.length }} uses</span>
          </div>

          <div v-if="progressState.bestIntervalMs > 0" class="flex items-center justify-between text-xs text-base-content/40">
            <span>personal best wait</span>
            <span class="font-mono font-medium text-base-content/60">{{ formatDuration(progressState.bestIntervalMs) }}</span>
          </div>
        </div>
      </div>

      <!-- Habit Timeline Card -->
      <div class="card bg-base-100 shadow" v-if="hasEnoughData">
        <div class="card-body gap-3">
          <div class="flex justify-between items-center">
            <h2 class="card-title text-base">habit timeline</h2>
            <span class="text-xs text-base-content/30">beat 4 in 10 to stay on track</span>
          </div>

          <div class="relative">
            <!-- Vertical line -->
            <div class="absolute left-[11px] top-4 bottom-4 w-0.5 bg-base-300"></div>

            <div class="space-y-2">
              <div
                v-for="(m, i) in habitTimeline"
                :key="m.id"
                class="flex items-start gap-3 relative"
              >
                <!-- Node -->
                <div
                  class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold z-10 mt-0.5"
                  :class="m.achieved ? 'bg-success text-success-content' : m.isCurrent ? 'bg-primary text-primary-content ring-2 ring-primary ring-offset-2 ring-offset-base-100' : 'bg-base-300 text-base-content/40'"
                >
                  {{ m.achieved ? '✓' : i + 1 }}
                </div>

                <!-- Content -->
                <div class="flex-1 pb-1">
                  <div class="flex justify-between items-baseline">
                    <span
                      class="text-sm font-medium leading-tight"
                      :class="m.achieved ? 'text-success' : m.isCurrent ? 'text-primary' : 'text-base-content/50'"
                    >{{ m.label }}</span>
                    <span class="text-xs text-base-content/40 shrink-0 ml-2">
                      {{ m.achieved ? 'reached' : m.isCurrent ? 'current' : m.etaLabel }}
                    </span>
                  </div>
                  <div class="text-xs text-base-content/40 mt-0.5">
                    every {{ m.intervalLabel }} &mdash; ~{{ m.usesPerDayLabel }}/day
                  </div>
                  <!-- Progress bar for current milestone -->
                  <div v-if="m.isCurrent && avgIntervalMs > 0" class="mt-1.5">
                    <progress
                      class="progress progress-primary w-full h-1.5"
                      :value="Math.min(avgIntervalMs / 3600000, m.minIntervalH)"
                      :max="m.minIntervalH"
                    ></progress>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div class="card bg-base-100 shadow" v-if="log.length">
        <div class="card-body gap-2">
          <div class="flex justify-between items-center">
            <h2 class="card-title text-base">history</h2>
            <button class="btn btn-ghost btn-xs text-error" @click="clearLog">clear all</button>
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

    </div>
  </div>

  <!-- Settings Modal -->
  <div v-if="showSettings" class="modal modal-open">
    <div class="modal-box w-full max-w-lg">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">configure</h3>
        <button class="btn btn-sm btn-circle btn-ghost" @click="closeSettings">✕</button>
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
        <button class="btn btn-primary" @click="saveSettings">save</button>
        <button class="btn btn-ghost" @click="closeSettings">cancel</button>
      </div>
    </div>
    <label class="modal-backdrop" @click="closeSettings"></label>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY    = 'nicquitin-log'
const PRODUCTS_KEY   = 'nicquitin-products'
const CARTRIDGE_KEY  = 'nicquitin-cartridges'
const PROFILE_KEY    = 'nicquitin-profile'
const PROGRESS_KEY   = 'nicquitin-progress'
const SESSIONS_KEY   = 'nicquitin-sessions'

const BASE_HL_H           = 2      // baseline nicotine half-life (hours)
const CLEAN_THRESHOLD     = 0.05   // mg
const GAUGE_MAX           = 15     // mg
const BEAT_STEP           = 0.08   // multiplier increase per beat
const INITIAL_MULTIPLIER  = 1.15   // 15% above avg to start
const MIN_ENTRIES_FOR_PATTERNS = 5 // need at least this many log entries

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = {
  sex: 'male', metabolizer: 'normal',
  menthol: false, pregnant: false, contraceptives: false,
}

const DEFAULT_PRODUCTS = [
  { id: 'cigarette', name: 'Cigarette',    emoji: '🚬', nicotineMg: 1.1,  releaseType: 'instant', releaseDurationH: 0,   hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: false, hasSwallowOption: false, hasReuseOption: false },
  { id: 'vape',      name: 'Vape',         emoji: '💨', nicotineMg: 0.1,  releaseType: 'instant', releaseDurationH: 0,   hasPuffCount: true,  useCartridgeCalc: true,  cartridgeNicotineMg: 20, cartridgeTotalPuffs: 200, hasSession: false, hasSwallowOption: false, hasReuseOption: false },
  { id: 'patch',     name: 'Patch (21mg)', emoji: '🩹', nicotineMg: 14,   releaseType: 'slow',    releaseDurationH: 16,  hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: true,  hasSwallowOption: false, hasReuseOption: false },
  { id: 'gum',       name: 'Gum (4mg)',    emoji: '🟡', nicotineMg: 2,    releaseType: 'slow',    releaseDurationH: 0.5, hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: true,  hasSwallowOption: true,  hasReuseOption: false },
  { id: 'pouch',     name: 'Pouch',        emoji: '🫙', nicotineMg: 3,    releaseType: 'slow',    releaseDurationH: 1,   hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: true,  hasSwallowOption: false, hasReuseOption: true  },
  { id: 'cigar',     name: 'Cigar',        emoji: '🍬', nicotineMg: 3,    releaseType: 'instant', releaseDurationH: 0,   hasPuffCount: false, useCartridgeCalc: false, cartridgeNicotineMg: 0,  cartridgeTotalPuffs: 0,   hasSession: false, hasSwallowOption: false, hasReuseOption: false },
]

const MILESTONE_DEFS = [
  { label: '❤️  Heart rate & BP drop',        offsetMs: 20  * 60 * 1000 },
  { label: '💨  Carbon monoxide clears',       offsetMs: 12  * 60 * 60 * 1000 },
  { label: '🧹  Nicotine-free (3 days)',       offsetMs: 3   * 24 * 60 * 60 * 1000 },
  { label: '🩸  Circulation improves (2 wks)', offsetMs: 14  * 24 * 60 * 60 * 1000 },
  { label: '🧠  Cravings greatly reduced',     offsetMs: 90  * 24 * 60 * 60 * 1000 },
  { label: '🏥  Heart disease risk halved',    offsetMs: 365 * 24 * 60 * 60 * 1000 },
]

// Habit timeline milestones (ordered lightest → heaviest so user sees where they are)
const HABIT_MILESTONE_DEFS = [
  { id: 'heavy',      label: 'Heavy use',     maxUsesDay: 15,   minIntervalH: 1.6,  usesPerDayLabel: '>15' },
  { id: 'regular',    label: 'Regular',       maxUsesDay: 10,   minIntervalH: 2.4,  usesPerDayLabel: '~10' },
  { id: 'moderate',   label: 'Moderate',      maxUsesDay: 5,    minIntervalH: 4.8,  usesPerDayLabel: '~5'  },
  { id: 'light',      label: 'Light use',     maxUsesDay: 3,    minIntervalH: 8,    usesPerDayLabel: '~3'  },
  { id: 'occasional', label: 'Occasional',    maxUsesDay: 1,    minIntervalH: 24,   usesPerDayLabel: '<1'  },
  { id: 'rare',       label: 'Very rare',     maxUsesDay: 0.33, minIntervalH: 72,   usesPerDayLabel: '<1/3d' },
  { id: 'free',       label: 'Habit free 🏆', maxUsesDay: 0,    minIntervalH: 168,  usesPerDayLabel: '~0'  },
]

// ─── State ────────────────────────────────────────────────────────────────────

const log               = ref([])
const products          = ref([])
const cartridgeSessions = ref({})
const profile           = ref({ ...DEFAULT_PROFILE })
const progressState     = ref({
  multiplier:      INITIAL_MULTIPLIER,
  totalBeats:      0,
  totalAttempts:   0,
  currentStreak:   0,
  bestStreak:      0,
  bestIntervalMs:  0,
  recentOutcomes:  [],  // last 10: true=beat, false=failed
})
const now               = ref(Date.now())
const showSettings      = ref(false)
const editableProducts  = ref([])
const editableProfile   = ref({ ...DEFAULT_PROFILE })
const expandedProduct   = ref(null)
const pendingProduct    = ref(null)
const puffCount         = ref(10)
const refillConfirm     = ref(null)  // { productId, actualPuffs, newEstimate, nicotineMg }
const importStatus      = ref(null)  // null | 'success' | 'error'
const importError       = ref('')
const activeSessions    = ref({})    // { [productId]: { startTs, reuseCount } }

let timer = null

onMounted(() => {
  const savedLog = localStorage.getItem(STORAGE_KEY)
  if (savedLog) log.value = JSON.parse(savedLog)

  const savedProducts = localStorage.getItem(PRODUCTS_KEY)
  products.value = savedProducts ? JSON.parse(savedProducts) : DEFAULT_PRODUCTS.map(p => ({ ...p }))

  const savedCartridges = localStorage.getItem(CARTRIDGE_KEY)
  if (savedCartridges) cartridgeSessions.value = JSON.parse(savedCartridges)

  const savedProfile = localStorage.getItem(PROFILE_KEY)
  if (savedProfile) profile.value = { ...DEFAULT_PROFILE, ...JSON.parse(savedProfile) }

  const savedProgress = localStorage.getItem(PROGRESS_KEY)
  if (savedProgress) progressState.value = { ...progressState.value, ...JSON.parse(savedProgress) }

  const savedSessions = localStorage.getItem(SESSIONS_KEY)
  if (savedSessions) activeSessions.value = JSON.parse(savedSessions)

  timer = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => clearInterval(timer))

// ─── Profile / adjusted half-life ────────────────────────────────────────────

const halfLifeH = computed(() => calcHalfLife(profile.value))
const previewHalfLifeH = computed(() => calcHalfLife(editableProfile.value))

function calcHalfLife(p) {
  let hl = BASE_HL_H
  if (p.sex === 'female') hl *= 0.83
  if (p.pregnant) hl *= 0.78
  if (p.sex === 'female' && p.contraceptives && !p.pregnant) hl *= 0.88
  if (p.metabolizer === 'slow') hl *= 1.75
  if (p.metabolizer === 'fast') hl *= 0.70
  if (p.menthol) hl *= 1.20
  return Math.round(hl * 100) / 100
}

// ─── Pharmacokinetics ────────────────────────────────────────────────────────

function nicotineFromEntry(entry, atMs, hl = halfLifeH.value) {
  const elapsedH = (atMs - entry.ts) / 3_600_000
  if (elapsedH <= 0) return 0
  const dose   = entry.nicotineMg ?? 0
  const lambda = Math.LN2 / hl
  if (entry.releaseType !== 'slow') return dose * Math.exp(-lambda * elapsedH)
  const D = Math.max(entry.releaseDurationH || 1, 0.01)
  if (elapsedH < D) return (dose / D) * (1 - Math.exp(-lambda * elapsedH)) / lambda
  return (dose / D) * Math.exp(-lambda * (elapsedH - D)) * (1 - Math.exp(-lambda * D)) / lambda
}

// Virtual entries for currently active sessions (ongoing slow-release)
const activeSessionEntries = computed(() =>
  Object.entries(activeSessions.value).flatMap(([productId, session]) => {
    const p = products.value.find(x => x.id === productId)
    if (!p) return []
    return [{ ts: session.startTs, nicotineMg: p.nicotineMg * Math.pow(0.5, session.reuseCount || 0), releaseType: p.releaseType, releaseDurationH: p.releaseDurationH }]
  })
)

const nicotineLevel = computed(() => {
  const fromLog    = log.value.reduce((s, e) => s + nicotineFromEntry(e, now.value), 0)
  const fromActive = activeSessionEntries.value.reduce((s, e) => s + nicotineFromEntry(e, now.value), 0)
  return Math.max(0, fromLog + fromActive)
})

const gaugeColor = computed(() => {
  const r = nicotineLevel.value / GAUGE_MAX
  if (r < 0.25) return 'progress-success'
  if (r < 0.6)  return 'progress-warning'
  return 'progress-error'
})

const timeUntilClean = computed(() => {
  if (nicotineLevel.value <= CLEAN_THRESHOLD) return null
  // 15-min steps over 3 days (288 steps).
  // Nicotine is physiologically cleared in ≤3 days even for heavy use.
  // 15-min resolution is accurate enough for display; the old 1-hour step
  // could overshoot by up to 60 min.
  const STEP = 15 * 60_000
  const hl = halfLifeH.value
  const entries = [...log.value, ...activeSessionEntries.value]
  let lastAbove = now.value
  for (let i = 1; i <= 3 * 24 * 4; i++) {
    const t = now.value + i * STEP
    if (entries.reduce((s, e) => s + nicotineFromEntry(e, t, hl), 0) > CLEAN_THRESHOLD) {
      lastAbove = t
    }
  }
  // lastAbove is the last 15-min boundary still above threshold.
  // Clean time is somewhere in (lastAbove, lastAbove + STEP], so we
  // report the midpoint of that window rather than always the far edge.
  return formatDuration(lastAbove - now.value + STEP / 2)
})

// ─── Pattern analysis ─────────────────────────────────────────────────────────

// Consecutive intervals between uses, filtered to > 5 min (ignore rapid re-logs)
const intervals = computed(() => {
  const sorted = [...log.value].sort((a, b) => a.ts - b.ts)
  const result = []
  for (let i = 1; i < sorted.length; i++) {
    // Interval starts when previous session ended (stoppedTs), not when it started
    const prevEnd = sorted[i - 1].stoppedTs || sorted[i - 1].ts
    const diff    = sorted[i].ts - prevEnd
    if (diff >= 5 * 60_000) result.push(diff)
  }
  return result
})

const hasEnoughData = computed(() => log.value.length >= MIN_ENTRIES_FOR_PATTERNS)

// Average of last 20 intervals (reflects current habit, not ancient history)
const avgIntervalMs = computed(() => {
  const recent = intervals.value.slice(-20)
  if (!recent.length) return 0
  return recent.reduce((s, v) => s + v, 0) / recent.length
})

const usesPerDay7d = computed(() => {
  const cutoff = now.value - 7 * 86_400_000
  return log.value.filter(e => e.ts >= cutoff).length / 7
})

// Trend: compare avg interval of last 7 vs previous 7 log entries
const trend = computed(() => {
  const half = 7
  const recent = intervals.value.slice(-half)
  const prev   = intervals.value.slice(-(half * 2), -half)
  if (recent.length < 3 || prev.length < 3) return 'neutral'
  const rAvg = recent.reduce((s, v) => s + v, 0) / recent.length
  const pAvg = prev.reduce((s, v) => s + v, 0) / prev.length
  if (rAvg > pAvg * 1.1) return 'improving'
  if (rAvg < pAvg * 0.9) return 'worsening'
  return 'stable'
})

const trendLabel = computed(() => ({ improving: '↗ improving', worsening: '↘ slipping', stable: '→ stable', neutral: '— —' }[trend.value]))
const trendColor = computed(() => ({ improving: 'text-success', worsening: 'text-error', stable: 'text-warning', neutral: 'text-base-content/40' }[trend.value]))

// Peak 3-hour windows by usage count
const peakHours = computed(() => {
  if (!log.value.length) return []
  const counts = new Array(24).fill(0)
  log.value.forEach(e => counts[new Date(e.ts).getHours()]++)
  const blocks = []
  for (let h = 0; h < 24; h += 3) {
    const count = counts[h] + counts[h + 1] + counts[h + 2]
    if (!count) continue
    const start   = h === 0 ? 12 : h > 12 ? h - 12 : h
    const end     = (h + 3) > 12 ? (h + 3 - 12) : (h + 3)
    const endAmpm = (h + 3) < 12 ? 'am' : 'pm'
    blocks.push({ label: `${start}–${end}${endAmpm}`, count })
  }
  return blocks.sort((a, b) => b.count - a.count).slice(0, 2)
})

// ─── Progressive beat target ──────────────────────────────────────────────────

const level = computed(() => progressState.value.totalBeats + 1)

const recentOutcomes = computed(() => progressState.value.recentOutcomes || [])

const recentSuccessRate = computed(() => {
  const o = recentOutcomes.value
  if (o.length < 3) return null
  return o.filter(Boolean).length / o.length
})

const recentDifficulty = computed(() => {
  const rate = recentSuccessRate.value
  if (rate === null) return null
  if (rate >= 0.7) return { label: 'dialed in',  color: 'text-success' }
  if (rate >= 0.4) return { label: 'on track',   color: 'text-warning' }
  return                  { label: 'easing up',  color: 'text-info'    }
})

const targetIntervalMs = computed(() =>
  avgIntervalMs.value > 0 ? avgIntervalMs.value * progressState.value.multiplier : 0
)

const timeSinceLastMs = computed(() =>
  lastUsed.value ? now.value - (lastUsed.value.stoppedTs || lastUsed.value.ts) : 0
)

const beatProgress = computed(() =>
  targetIntervalMs.value > 0 ? timeSinceLastMs.value / targetIntervalMs.value : 0
)

const hasBeatenTarget = computed(() => beatProgress.value >= 1)

const timeToTarget = computed(() => {
  const remaining = targetIntervalMs.value - timeSinceLastMs.value
  return remaining > 0 ? formatDuration(remaining) : null
})

const beatTimerColor = computed(() => {
  if (!hasEnoughData.value) {
    // Fall back to original coloring when no pattern data
    const s = timeSinceLastMs.value / 1000
    if (s < 1800) return 'text-error'
    if (s < 7200) return 'text-warning'
    return 'text-success'
  }
  if (hasBeatenTarget.value) return 'text-success'
  if (beatProgress.value > 0.75) return 'text-warning'
  return 'text-error'
})

function checkBeat(intervalMs) {
  if (avgIntervalMs.value === 0) return
  const target  = avgIntervalMs.value * progressState.value.multiplier
  const success = intervalMs >= target

  // Rolling window of last 10 outcomes
  const outcomes = [...(progressState.value.recentOutcomes || []), success].slice(-10)
  progressState.value.recentOutcomes = outcomes
  progressState.value.totalAttempts  = (progressState.value.totalAttempts || 0) + 1

  const recentRate = outcomes.length >= 3
    ? outcomes.filter(Boolean).length / outcomes.length
    : null

  if (success) {
    progressState.value.totalBeats++
    progressState.value.currentStreak++
    progressState.value.bestStreak     = Math.max(progressState.value.bestStreak, progressState.value.currentStreak)
    progressState.value.bestIntervalMs = Math.max(progressState.value.bestIntervalMs, intervalMs)
    // Hot streak bonus: each consecutive beat adds a little extra push (capped at +0.025)
    const streakBonus = Math.min(progressState.value.currentStreak * 0.005, 0.025)
    progressState.value.multiplier = Math.min(
      parseFloat((progressState.value.multiplier + BEAT_STEP + streakBonus).toFixed(4)),
      8   // cap: 8× avg ≈ a day or more
    )
  } else {
    progressState.value.currentStreak = 0
    // Ease back when struggling: reduce multiplier proportional to recent failure rate
    // Only kicks in once we have ≥3 data points and success rate < 40%
    if (recentRate !== null && recentRate < 0.4) {
      const reduction = BEAT_STEP * (0.4 - recentRate) / 0.4
      progressState.value.multiplier = Math.max(
        parseFloat((progressState.value.multiplier - reduction).toFixed(4)),
        INITIAL_MULTIPLIER  // floor: never drop below the starting challenge
      )
    }
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState.value))
}

// ─── Habit timeline ───────────────────────────────────────────────────────────

const habitTimeline = computed(() => {
  const avgH        = avgIntervalMs.value / 3_600_000
  const usesPerD    = usesPerDay7d.value || 1
  const beatsPerDay = usesPerD * (recentSuccessRate.value ?? 0.35)

  return HABIT_MILESTONE_DEFS.map(m => {
    const achieved  = avgH >= m.minIntervalH
    // "current" = the milestone the user is closest to but hasn't passed
    const isCurrent = !achieved && avgH >= (HABIT_MILESTONE_DEFS[HABIT_MILESTONE_DEFS.indexOf(m) - 1]?.minIntervalH ?? 0)

    // Levels (beats) needed to push target interval up to this milestone
    const currentTargetH = avgH * progressState.value.multiplier
    let beatsNeeded = 0
    if (!achieved && currentTargetH < m.minIntervalH) {
      beatsNeeded = Math.ceil(Math.log(m.minIntervalH / currentTargetH) / Math.log(1 + BEAT_STEP))
    }

    const daysNeeded = beatsNeeded > 0 && beatsPerDay > 0 ? beatsNeeded / beatsPerDay : 0
    let etaLabel = ''
    if (!achieved && daysNeeded > 0) {
      etaLabel = daysNeeded < 7
        ? `~${Math.round(daysNeeded)}d`
        : daysNeeded < 60
        ? `~${Math.round(daysNeeded / 7)}w`
        : `~${Math.round(daysNeeded / 30)}mo`
    }

    // Human-readable interval
    const h = m.minIntervalH
    const intervalLabel = h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h}h` : h < 168 ? `${Math.round(h / 24)}d` : `${Math.round(h / 168)}w`

    return { ...m, achieved, isCurrent, beatsNeeded, daysNeeded, etaLabel, intervalLabel }
  })
})

// ─── Cartridge tracking ───────────────────────────────────────────────────────

function puffsUsed(productId) {
  const session = cartridgeSessions.value[productId]
  if (!session) return 0
  return log.value
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
  const p = products.value.find(x => x.id === productId)
  if (!p) return
  cartridgeSessions.value = { ...cartridgeSessions.value, [productId]: { startTs: Date.now(), totalPuffs: p.cartridgeTotalPuffs || 200 } }
  localStorage.setItem(CARTRIDGE_KEY, JSON.stringify(cartridgeSessions.value))
}

function initiateRefill(productId) {
  const actual = puffsUsed(productId)
  if (actual === 0) { newCartridge(productId); return }
  const p = products.value.find(x => x.id === productId)
  refillConfirm.value = {
    productId,
    actualPuffs:    actual,
    newEstimate:    actual,   // pre-filled with actual so user just taps confirm
    nicotineMg:     p?.cartridgeNicotineMg ?? 0,
  }
}

function confirmRefill(productId) {
  if (!refillConfirm.value) return
  const p = products.value.find(x => x.id === productId)
  if (p && refillConfirm.value.newEstimate > 0) {
    p.cartridgeTotalPuffs = refillConfirm.value.newEstimate
    if (p.useCartridgeCalc && p.cartridgeNicotineMg > 0) {
      p.nicotineMg = parseFloat((p.cartridgeNicotineMg / refillConfirm.value.newEstimate).toFixed(6))
    }
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.value))
  }
  refillConfirm.value = null
  newCartridge(productId)
}

// ─── Session tracking (patch, gum, pouch) ────────────────────────────────────

function startSession(productId) {
  activeSessions.value = { ...activeSessions.value, [productId]: { startTs: Date.now(), reuseCount: 0 } }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions.value))
}

function stopSession(productId, opts = {}) {
  const session = activeSessions.value[productId]
  if (!session) return
  const p = products.value.find(x => x.id === productId)
  if (!p) return

  const stopTs         = Date.now()
  const actualDurationH = (stopTs - session.startTs) / 3_600_000
  const maxDurationH    = p.releaseDurationH || 1

  let scaledMg = p.nicotineMg * Math.min(1, actualDurationH / maxDurationH)
  scaledMg    *= Math.pow(0.5, session.reuseCount || 0)
  if (opts.swallowed) scaledMg *= 1.08  // gum: extra absorption when swallowed

  const prevEntry = log.value[0]
  log.value.unshift({
    id: session.startTs, productId: p.id, product: p.name, emoji: p.emoji,
    nicotineMg: scaledMg,
    releaseType: p.releaseType,
    releaseDurationH: Math.min(actualDurationH, maxDurationH),
    puffs: null,
    ts: session.startTs, stoppedTs: stopTs,
    reuseCount: session.reuseCount || 0,
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))

  if (prevEntry && hasEnoughData.value) {
    const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
    const interval = session.startTs - prevEnd
    if (interval >= 5 * 60_000) checkBeat(interval)
  }

  const updated = { ...activeSessions.value }
  delete updated[productId]
  activeSessions.value = updated
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions.value))
  pendingProduct.value = null
}

function reusePouch(productId) {
  const session = activeSessions.value[productId]
  if (!session) return
  const p = products.value.find(x => x.id === productId)
  if (!p) return

  const stopTs          = Date.now()
  const actualDurationH = (stopTs - session.startTs) / 3_600_000
  const maxDurationH    = p.releaseDurationH || 1

  let scaledMg = p.nicotineMg * Math.min(1, actualDurationH / maxDurationH)
  scaledMg    *= Math.pow(0.5, session.reuseCount || 0)

  // Log the completed sub-session
  log.value.unshift({
    id: session.startTs, productId: p.id, product: p.name, emoji: p.emoji,
    nicotineMg: scaledMg, releaseType: p.releaseType,
    releaseDurationH: Math.min(actualDurationH, maxDurationH),
    puffs: null, ts: session.startTs, stoppedTs: stopTs,
    reuseCount: session.reuseCount || 0,
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))

  // Start new session immediately with incremented reuse count
  activeSessions.value = {
    ...activeSessions.value,
    [productId]: { startTs: Date.now(), reuseCount: (session.reuseCount || 0) + 1 },
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions.value))
  pendingProduct.value = null
}

function sessionElapsed(productId) {
  const session = activeSessions.value[productId]
  if (!session) return ''
  const s = Math.floor((now.value - session.startTs) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

function sessionElapsedShort(productId) {
  const session = activeSessions.value[productId]
  if (!session) return ''
  const s = Math.floor((now.value - session.startTs) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  return `${m}m`
}

// ─── Logging ─────────────────────────────────────────────────────────────────

const lastUsed = computed(() => log.value[0] ?? null)

function selectProduct(p) {
  if (p.hasSession) {
    if (activeSessions.value[p.id]) {
      // Toggle stop panel
      pendingProduct.value = pendingProduct.value?.id === p.id ? null : p
    } else {
      // Start session immediately
      startSession(p.id)
      pendingProduct.value = null
    }
    return
  }
  if (p.hasPuffCount) {
    const closing = pendingProduct.value?.id === p.id
    pendingProduct.value = closing ? null : p
    if (closing || pendingProduct.value?.id !== refillConfirm.value?.productId) refillConfirm.value = null
    puffCount.value = 10
  } else {
    doLog(p, null)
    pendingProduct.value = null
    refillConfirm.value = null
  }
}

function confirmLog() {
  if (!pendingProduct.value) return
  doLog(pendingProduct.value, puffCount.value)
  pendingProduct.value = null
}

function doLog(p, puffs) {
  const prevEntry  = log.value[0]
  const ts         = Date.now()
  const nicotineMg = puffs != null ? puffs * p.nicotineMg : p.nicotineMg

  log.value.unshift({ id: ts, productId: p.id, product: p.name, emoji: p.emoji, nicotineMg, releaseType: p.releaseType, releaseDurationH: p.releaseDurationH, puffs, ts })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))

  // Check beat AFTER inserting (avgIntervalMs still reflects pre-insert state
  // since it uses log.value which hasn't triggered the computed yet — but we
  // need the interval before insert, so compute it directly)
  if (prevEntry && hasEnoughData.value) {
    const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
    const interval = ts - prevEnd
    if (interval >= 5 * 60_000) checkBeat(interval)
  }
}

function removeEntry(id) {
  log.value = log.value.filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
}

function clearLog() {
  log.value = []
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.value))
}

// ─── Timer ────────────────────────────────────────────────────────────────────

const elapsed = computed(() => {
  if (!lastUsed.value) return null
  const s   = Math.floor(timeSinceLastMs.value / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`
  if (m > 0) return `${m}m ${String(sec).padStart(2,'0')}s`
  return `${sec}s`
})

// ─── Recovery milestones ──────────────────────────────────────────────────────

const milestones = computed(() => {
  if (!lastUsed.value) return []
  const baseTs = lastUsed.value.stoppedTs || lastUsed.value.ts
  return MILESTONE_DEFS.map(m => {
    const ts       = baseTs + m.offsetMs
    const achieved = now.value >= ts
    return { label: m.label, ts, achieved, remaining: achieved ? null : formatDuration(ts - now.value), ago: achieved ? relativeAgo(ts) : null }
  })
})

// ─── Settings ─────────────────────────────────────────────────────────────────

function openSettings() {
  editableProducts.value = products.value.map(p => ({ ...p }))
  editableProfile.value  = { ...profile.value }
  expandedProduct.value  = null
  showSettings.value     = true
}

function closeSettings() { showSettings.value = false; importStatus.value = null }

// ─── Import / Export ──────────────────────────────────────────────────────────

function exportData() {
  const payload = {
    version:   1,
    exported:  new Date().toISOString(),
    log:       log.value,
    products:  products.value,
    cartridges: cartridgeSessions.value,
    sessions:  activeSessions.value,
    profile:   profile.value,
    progress:  progressState.value,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `nicquitin-${new Date().toISOString().slice(0, 10)}.json`
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

      if (data.log)       { log.value = data.log;                                          localStorage.setItem(STORAGE_KEY,   JSON.stringify(data.log)) }
      if (data.products)  { products.value = data.products;                                localStorage.setItem(PRODUCTS_KEY,  JSON.stringify(data.products)) }
      if (data.cartridges){ cartridgeSessions.value = data.cartridges;                     localStorage.setItem(CARTRIDGE_KEY, JSON.stringify(data.cartridges)) }
      if (data.sessions)  { activeSessions.value = data.sessions;                          localStorage.setItem(SESSIONS_KEY,  JSON.stringify(data.sessions)) }
      if (data.profile)   { profile.value = { ...DEFAULT_PROFILE, ...data.profile };       localStorage.setItem(PROFILE_KEY,   JSON.stringify(profile.value)) }
      if (data.progress)  { progressState.value = { ...progressState.value, ...data.progress }; localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState.value)) }

      // Refresh editable copies so settings modal reflects imported data
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

function saveSettings() {
  products.value = editableProducts.value.map(p =>
    p.hasPuffCount && p.useCartridgeCalc && p.cartridgeTotalPuffs > 0
      ? { ...p, nicotineMg: p.cartridgeNicotineMg / p.cartridgeTotalPuffs }
      : p
  )
  profile.value = { ...editableProfile.value }
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products.value))
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
  showSettings.value = false
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

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  const totalMin = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 24) { const d = Math.floor(h / 24), rh = h % 24; return rh > 0 ? `${d}d ${rh}h` : `${d}d` }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${totalMin}m`
}

function relativeAgo(ts) {
  const diff = now.value - ts
  if (diff < 3_600_000)  return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return `${Math.round(diff / 86_400_000)}d ago`
}
</script>
