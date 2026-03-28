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

      <!-- Active Sessions Card -->
      <div v-if="hasActiveSessions" class="card bg-base-100 shadow">
        <div class="card-body gap-3 py-4">
          <h2 class="card-title text-base">in use</h2>

          <!-- Patch / Gum and other single-session products -->
          <div v-for="(session, productId) in activeSessions" :key="productId" class="space-y-2">
            <template v-if="productById(productId)">
              <div class="flex justify-between items-center text-sm">
                <span class="font-medium">{{ productById(productId).emoji }} {{ productById(productId).name }}</span>
                <span class="font-mono text-xs text-base-content/60">{{ sessionElapsed(productId) }}</span>
              </div>
              <template v-if="productById(productId).releaseDurationH > 0">
                <div class="flex justify-between text-xs mb-0.5">
                  <span :class="sessionProgress(productId) >= 1 ? 'text-success font-medium' : 'text-base-content/50'">
                    {{ sessionProgress(productId) >= 1 ? '✓ run its course' : sessionTimeRemaining(productId) + ' remaining' }}
                  </span>
                  <span class="text-base-content/40">{{ Math.min(100, Math.round(sessionProgress(productId) * 100)) }}%</span>
                </div>
                <progress
                  class="progress w-full h-2"
                  :class="sessionProgress(productId) >= 1 ? 'progress-success' : 'progress-primary'"
                  :value="Math.min(sessionProgress(productId), 1)"
                  max="1"
                ></progress>
                <p class="text-xs" :class="sessionProgress(productId) >= 1 ? 'text-success/70' : 'text-base-content/30'">
                  {{ sessionProgress(productId) >= 1
                    ? 'full ' + productById(productId).nicotineMg.toFixed(1) + 'mg absorbed — remove when ready'
                    : '~' + sessionEstimatedDose(productId) + 'mg absorbed if removed now' }}
                </p>
              </template>
              <template v-if="productById(productId).hasSwallowOption">
                <div class="flex gap-2 pt-1">
                  <button class="btn btn-outline btn-sm flex-1" @click="stopSession(productId, { swallowed: false })">🚮 spit out</button>
                  <button class="btn btn-primary btn-sm flex-1" @click="stopSession(productId, { swallowed: true })">⬇ swallow</button>
                </div>
              </template>
              <template v-else>
                <button class="btn btn-primary btn-sm w-full mt-1" @click="stopSession(productId)">remove {{ productById(productId).emoji }}</button>
              </template>
            </template>
          </div>

          <!-- Pouch sessions (multiple, pauseable) -->
          <div v-for="s in pouchSessions" :key="s.id" class="space-y-2 pt-1" :class="{ 'opacity-60': s.paused }">
            <div class="flex justify-between items-center text-sm">
              <span class="font-medium">
                🫙 Pouch
                <span v-if="s.reuseCount > 0" class="text-warning text-xs ml-1">reuse ×{{ s.reuseCount }}</span>
              </span>
              <span class="font-mono text-xs" :class="s.paused ? 'text-base-content/40' : 'text-base-content/60'">
                {{ s.paused ? '⏸ in tin' : pouchElapsedDisplay(s) }}
              </span>
            </div>
            <!-- Progress bar (based on active time only) -->
            <div class="space-y-0.5">
              <div class="flex justify-between text-xs">
                <span :class="pouchProgressVal(s) >= 1 ? 'text-success font-medium' : s.paused ? 'text-base-content/40' : 'text-base-content/50'">
                  {{ pouchProgressVal(s) >= 1 ? '✓ fully absorbed' : pouchTimeRemainingDisplay(s) }}
                </span>
                <span class="text-base-content/40">{{ Math.min(100, Math.round(pouchProgressVal(s) * 100)) }}%</span>
              </div>
              <progress
                class="progress w-full h-2"
                :class="pouchProgressVal(s) >= 1 ? 'progress-success' : s.paused ? 'progress-warning' : 'progress-primary'"
                :value="Math.min(pouchProgressVal(s), 1)"
                max="1"
              ></progress>
              <p class="text-xs text-base-content/30">
                ~{{ pouchEstimatedDoseDisplay(s) }}mg absorbed{{ s.paused ? ' (paused)' : ' if removed now' }}
              </p>
            </div>
            <div class="flex gap-2 pt-1">
              <button v-if="s.paused" class="btn btn-primary btn-sm flex-1" @click="resumePouch(s.id)">▶ put back in</button>
              <button v-else class="btn btn-outline btn-sm flex-1" @click="pausePouch(s.id)">⏸ put in tin</button>
              <button class="btn btn-error btn-outline btn-sm flex-1" @click="removePouchDone(s.id)">✓ done</button>
            </div>
          </div>

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
                pendingProduct?.id === p.id ? 'btn-primary border-primary' :
                (p.id === 'pouch' && pouchSessions.length > 0) ? 'btn-success border-success opacity-70' :
                (p.hasSession && activeSessions[p.id]) ? 'btn-success border-success opacity-70' : '',
              ]"
              @click="selectProduct(p)"
            >
              <span class="text-xl">{{ p.emoji }}</span>
              <span class="text-xs leading-tight">{{ p.name }}</span>
              <span class="text-[10px] text-base-content/40">
                {{ p.nicotineMg.toFixed(3) }}mg{{ p.hasPuffCount ? '/puff' : '' }}
              </span>
              <span v-if="p.id === 'pouch' && pouchSessions.length > 0" class="text-[10px] text-primary font-mono">
                {{ pouchSessions.length }} active · + new
              </span>
              <span v-else-if="p.id === 'pouch'" class="text-[10px] text-base-content/30">tap to start</span>
              <span v-else-if="p.hasSession && activeSessions[p.id]" class="text-[10px] font-mono"
                :class="sessionProgress(p.id) >= 1 ? 'text-success' : 'text-primary'">
                {{ sessionProgress(p.id) >= 1 ? '✓ done' : '⏱ ' + sessionElapsedShort(p.id) }}
              </span>
              <span v-else-if="p.hasSession" class="text-[10px] text-base-content/30">tap to start</span>
              <span
                v-else-if="p.hasPuffCount && cartridgeSessions[p.id]"
                class="text-[10px]"
                :class="cartridgePct(p.id) < 20 ? 'text-error' : 'text-base-content/40'"
              >{{ puffsRemaining(p.id) }} left</span>
            </button>
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
import { storeToRefs } from 'pinia'
import { calcHalfLife } from './lib/pharmacokinetics.js'
import { formatDuration, formatDateTime, relativeAgo } from './lib/format.js'

import { useTimeStore }     from './stores/time.js'
import { useLogStore }      from './stores/log.js'
import { useProfileStore }  from './stores/profile.js'
import { useProductsStore } from './stores/products.js'
import { useSessionsStore } from './stores/sessions.js'
import { useProgressStore } from './stores/progress.js'
import { useNicotineStore, GAUGE_MAX, CLEAN_THRESHOLD } from './stores/nicotine.js'
import { BEAT_STEP } from './stores/progress.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_ENTRIES_FOR_PATTERNS = 5

const MILESTONE_DEFS = [
  { label: '❤️  Heart rate & BP drop',        offsetMs: 20  * 60 * 1000 },
  { label: '💨  Carbon monoxide clears',       offsetMs: 12  * 60 * 60 * 1000 },
  { label: '🧹  Nicotine-free (3 days)',       offsetMs: 3   * 24 * 60 * 60 * 1000 },
  { label: '🩸  Circulation improves (2 wks)', offsetMs: 14  * 24 * 60 * 60 * 1000 },
  { label: '🧠  Cravings greatly reduced',     offsetMs: 90  * 24 * 60 * 60 * 1000 },
  { label: '🏥  Heart disease risk halved',    offsetMs: 365 * 24 * 60 * 60 * 1000 },
]

// ─── Store instances ──────────────────────────────────────────────────────────

const timeStore     = useTimeStore()
const logStore      = useLogStore()
const profileStore  = useProfileStore()
const productsStore = useProductsStore()
const sessionsStore = useSessionsStore()
const progressStore = useProgressStore()
const nicotineStore = useNicotineStore()

// ─── Reactive destructuring ───────────────────────────────────────────────────

const { log, lastUsed, hasEnoughData, avgIntervalMs, usesPerDay7d, trend, peakHours } = storeToRefs(logStore)
const { profile, halfLifeH } = storeToRefs(profileStore)
const { products, cartridgeSessions } = storeToRefs(productsStore)
const { activeSessions, pouchSessions, hasActiveSessions } = storeToRefs(sessionsStore)
const {
  progressState, level, recentOutcomes, recentDifficulty,
  targetIntervalMs, timeSinceLastMs, beatProgress, hasBeatenTarget, timeToTarget,
  beatTimerColor, habitTimeline,
} = storeToRefs(progressStore)
const { nicotineLevel, gaugeColor, timeUntilClean } = storeToRefs(nicotineStore)

// ─── Store method aliases ─────────────────────────────────────────────────────

const { removeEntry, clearAll: clearLog } = logStore
const { productById, puffsUsed, puffsRemaining, cartridgePct, newCartridge } = productsStore
const {
  startSession, stopSession, startPouchSession, pausePouch, resumePouch, removePouchDone,
  sessionElapsed, sessionElapsedShort, sessionProgress, sessionTimeRemaining, sessionEstimatedDose,
  pouchProgressVal, pouchElapsedDisplay, pouchTimeRemainingDisplay, pouchEstimatedDoseDisplay,
} = sessionsStore

// ─── UI-only state ────────────────────────────────────────────────────────────

const showSettings     = ref(false)
const editableProducts = ref([])
const editableProfile  = ref({})
const expandedProduct  = ref(null)
const pendingProduct   = ref(null)
const puffCount        = ref(10)
const refillConfirm    = ref(null)  // { productId, actualPuffs, newEstimate, nicotineMg }
const importStatus     = ref(null)  // null | 'success' | 'error'
const importError      = ref('')

// ─── Local computeds ──────────────────────────────────────────────────────────

const previewHalfLifeH = computed(() => calcHalfLife(editableProfile.value))

const trendLabel = computed(() => ({ improving: '↗ improving', worsening: '↘ slipping', stable: '→ stable', neutral: '— —' }[trend.value]))
const trendColor = computed(() => ({ improving: 'text-success', worsening: 'text-error', stable: 'text-warning', neutral: 'text-base-content/40' }[trend.value]))

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

const milestones = computed(() => {
  if (!lastUsed.value) return []
  const baseTs = lastUsed.value.stoppedTs || lastUsed.value.ts
  return MILESTONE_DEFS.map(m => {
    const ts       = baseTs + m.offsetMs
    const achieved = timeStore.now >= ts
    return { label: m.label, ts, achieved, remaining: achieved ? null : formatDuration(ts - timeStore.now), ago: achieved ? relativeAgo(ts, timeStore.now) : null }
  })
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  timeStore.start()
  logStore.load()
  profileStore.load()
  productsStore.load()
  progressStore.load()
  sessionsStore.load()
})

onUnmounted(() => timeStore.stop())

// ─── Logging ─────────────────────────────────────────────────────────────────

function selectProduct(p) {
  if (p.id === 'pouch') {
    startPouchSession()
    return
  }
  if (p.hasSession) {
    if (!activeSessions.value[p.id]) {
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

  logStore.addEntry({ id: ts, productId: p.id, product: p.name, emoji: p.emoji, nicotineMg, releaseType: p.releaseType, releaseDurationH: p.releaseDurationH, puffs, ts })

  if (prevEntry && hasEnoughData.value) {
    const prevEnd  = prevEntry.stoppedTs || prevEntry.ts
    const interval = ts - prevEnd
    if (interval >= 5 * 60_000) progressStore.checkBeat(interval)
  }
}

// ─── Cartridge refill ─────────────────────────────────────────────────────────

function initiateRefill(productId) {
  const actual = puffsUsed(productId)
  if (actual === 0) { newCartridge(productId); return }
  const p = productById(productId)
  refillConfirm.value = { productId, actualPuffs: actual, newEstimate: actual, nicotineMg: p?.cartridgeNicotineMg ?? 0 }
}

function confirmRefill(productId) {
  if (!refillConfirm.value) return
  productsStore.applyRefill(productId, refillConfirm.value.newEstimate)
  refillConfirm.value = null
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function openSettings() {
  editableProducts.value = products.value.map(p => ({ ...p }))
  editableProfile.value  = { ...profile.value }
  expandedProduct.value  = null
  showSettings.value     = true
}

function closeSettings() { showSettings.value = false; importStatus.value = null }

function saveSettings() {
  productsStore.saveProducts(editableProducts.value)
  profileStore.save(editableProfile.value)
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
