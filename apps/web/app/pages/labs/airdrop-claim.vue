<script setup lang="ts">
/**
 * Round-1 lure for the Approval & Drain Lab.
 *
 * Ethics, restated where the damage would happen:
 * - Testnet only. LabAUD is worthless and staff refund every drain.
 * - "Brightfold Rewards" is invented. No real protocol, token, exchange or person is imitated.
 * - The wallet prompt stays honest: it asks for unlimited spending permission, in plain terms.
 *   Only the page around it lies. That gap is the lesson.
 * - The debrief opens automatically within 60 seconds of signing.
 * - The footer carries a real opt-out.
 */
definePageMeta({ layout: false })
useHead({ title: 'Brightfold Rewards | Claim' })

const DEBRIEF_AFTER_MS = 60_000

const { isConnected, pendingAction, actionError, approveRound1Lure, claimLure } = useApprovalLab()
const { connect } = useWallet()

const step = shallowRef<'idle' | 'approving' | 'claiming' | 'done'>('idle')
const waited = shallowRef(0)
const remaining = shallowRef('47:12')
const deadline = Date.now() + (47 * 60 + 12) * 1_000

let countdown: ReturnType<typeof setInterval> | undefined
let waitTicker: ReturnType<typeof setInterval> | undefined
let debriefTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  // Fake urgency. Every real lure has one.
  countdown = setInterval(() => {
    const ms = Math.max(0, deadline - Date.now())
    remaining.value = `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0')}`
  }, 1_000)
})

onBeforeUnmount(() => {
  clearInterval(countdown)
  clearInterval(waitTicker)
  clearTimeout(debriefTimer)
})

async function claim() {
  step.value = 'approving'
  if (!await approveRound1Lure()) {
    // Refusing is the right answer. Say nothing that pushes them to try again.
    step.value = 'idle'
    return
  }
  step.value = 'claiming'
  await claimLure()
  step.value = 'done'
  waitTicker = setInterval(() => { waited.value += 1 }, 1_000)
  debriefTimer = setTimeout(() => navigateTo('/labs/approval-debrief'), DEBRIEF_AFTER_MS)
}

const testimonials = [
  { text: 'Claimed in 20 seconds, already up 3x. Don’t sleep on this one.', who: '@degen_maxi' },
  { text: 'Been farming since the first testnet. Finally paid off.', who: '@0xharper' },
  { text: 'Window is closing fast, got mine.', who: '@lin_onchain' },
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-violet-50 via-sky-50 to-orange-50 px-5 pt-10 pb-16 text-slate-900">
    <p class="text-center text-xs font-extrabold tracking-[0.2em] text-violet-600">◆ BRIGHTFOLD</p>

    <div class="mx-auto mt-7 max-w-lg rounded-3xl bg-white p-8 text-center shadow-[0_18px_50px_rgba(40,30,90,0.12)]">
      <span class="inline-block rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold tracking-[0.09em] text-violet-600">
        SEASON 1 · ALLOCATION CONFIRMED
      </span>
      <h1 class="mt-5 text-2xl font-bold leading-tight">You are eligible for 5,000 BFLD</h1>
      <p class="mt-3 text-sm leading-relaxed text-slate-500">
        Your wallet qualified through early testnet activity. Allocations not claimed before the window closes are redistributed to the community pool.
      </p>

      <div class="mt-6 grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-slate-50 px-2 py-3">
          <p class="text-[11px] text-slate-400">Your allocation</p>
          <p class="mt-1 font-bold">5,000 BFLD</p>
        </div>
        <div class="rounded-xl bg-slate-50 px-2 py-3">
          <p class="text-[11px] text-slate-400">Est. value</p>
          <p class="mt-1 font-bold">$4,812</p>
        </div>
        <div class="rounded-xl bg-slate-50 px-2 py-3">
          <p class="text-[11px] text-slate-400">Window closes</p>
          <p class="mt-1 font-bold text-red-600">{{ remaining }}</p>
        </div>
      </div>

      <ClientOnly>
        <div class="mt-6">
          <button
            v-if="!isConnected"
            class="w-full rounded-xl bg-violet-600 px-4 py-4 font-bold text-white hover:bg-violet-700"
            @click="() => connect()"
          >
            Connect wallet to claim
          </button>

          <div v-else-if="step === 'done'" class="rounded-xl border border-green-200 bg-green-50 p-5">
            <p class="font-bold">Claim submitted ✓</p>
            <p class="mt-1 text-sm text-slate-600">Your 5,000 BFLD will arrive within 30 seconds. You can close this page.</p>
            <p class="mt-3 text-xs text-slate-400">Waiting… {{ waited }}s</p>
          </div>

          <button
            v-else
            class="w-full rounded-xl bg-violet-600 px-4 py-4 font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            :disabled="step !== 'idle' || pendingAction !== null"
            @click="claim"
          >
            {{ step === 'approving' ? 'Confirm in your wallet…' : step === 'claiming' ? 'Claiming…' : 'Claim 5,000 BFLD' }}
          </button>

          <p v-if="actionError && step === 'idle'" class="mt-3 text-sm text-red-600">{{ actionError }}</p>
        </div>
      </ClientOnly>

      <p class="mt-4 text-xs leading-relaxed text-slate-400">
        Claiming requires a one-time wallet verification to confirm you control this address. Gas fees apply.
      </p>
    </div>

    <div class="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
      <div v-for="quote in testimonials" :key="quote.who" class="w-56 rounded-xl border border-violet-100 bg-white/75 p-4">
        <p class="text-sm leading-relaxed">{{ quote.text }}</p>
        <p class="mt-2 text-xs text-slate-400">{{ quote.who }}</p>
      </div>
    </div>

    <p class="mt-7 text-center text-xs text-slate-400">TVL $48.2M · 31,904 wallets claimed · Audited</p>

    <p class="mt-12 text-center">
      <NuxtLink to="/labs/approval-debrief" class="text-[11px] text-slate-400 underline">
        UNSW course participant? Opt out of this activity
      </NuxtLink>
    </p>
  </div>
</template>
