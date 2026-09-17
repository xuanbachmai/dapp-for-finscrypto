<script setup lang="ts">
/**
 * Round-2 lure for the Approval & Drain Lab.
 *
 * The opposite pitch to round 1: it offers protection from the thing that just happened, when
 * the Student is primed to worry about approvals, and asks for an approval to provide it.
 * Passing means signing nothing, which is why completion is checked on-chain, not here.
 *
 * Same ethics rules as round 1. "Sentrywell" is an invented name.
 */
definePageMeta({ layout: false })
useHead({ title: 'Sentrywell | Wallet check' })

const { isConnected, pendingAction, approveRound2Lure } = useApprovalLab()
const { connect } = useWallet()

const state = shallowRef<'idle' | 'scanning' | 'found' | 'signing' | 'done'>('idle')

function fakeScan() {
  state.value = 'scanning'
  setTimeout(() => { state.value = 'found' }, 2_200)
}

async function protect() {
  state.value = 'signing'
  // The same attack, wearing a hat that says "security".
  state.value = await approveRound2Lure() ? 'done' : 'found'
}

const risks = [
  { token: 'LAUD', spender: '0x9f2c…41ab' },
  { token: 'LAUD', spender: '0x3ed0…77c1' },
  { token: 'USDC', spender: '0xb418…09fe' },
]
</script>

<template>
  <div class="min-h-screen bg-[#0f1420] px-5 pt-16 pb-10 text-slate-100">
    <div class="mx-auto max-w-md rounded-2xl border border-[#232c40] bg-[#161d2c] p-8 text-center">
      <p class="font-extrabold tracking-wide text-emerald-400">
        <UIcon name="i-lucide-shield" class="mr-1 inline size-4 align-[-2px]" /> Sentrywell
      </p>

      <ClientOnly>
        <template v-if="state === 'idle'">
          <h1 class="mt-5 text-2xl font-bold leading-snug">Check your wallet for malicious approvals</h1>
          <p class="mt-3 text-sm leading-relaxed text-slate-400">
            Free scan across 4 networks. Sentrywell finds open token allowances and revokes them in a single transaction.
          </p>
          <button
            v-if="!isConnected"
            class="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3.5 font-bold text-emerald-950"
            @click="() => connect()"
          >
            Connect wallet
          </button>
          <button v-else class="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3.5 font-bold text-emerald-950" @click="fakeScan">
            Scan my wallet — free
          </button>
        </template>

        <template v-else-if="state === 'scanning'">
          <h1 class="mt-5 text-2xl font-bold">Scanning…</h1>
          <p class="mt-3 text-sm text-slate-400">Checking Ethereum, Base, Sepolia and Base Sepolia.</p>
          <div class="mt-5 h-1.5 overflow-hidden rounded-full bg-[#232c40]">
            <div class="h-full w-3/5 animate-pulse bg-emerald-500" />
          </div>
        </template>

        <template v-else-if="state === 'found' || state === 'signing'">
          <p class="mt-5 rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm font-semibold text-red-300">
            3 high-risk approvals detected
          </p>
          <h1 class="mt-4 text-2xl font-bold">Your wallet is exposed</h1>
          <p class="mt-3 text-sm leading-relaxed text-slate-400">
            Unlimited allowances were found on this address. Enable one-click protection to revoke all three now.
          </p>
          <div class="mt-5 text-left">
            <div v-for="risk in risks" :key="risk.spender" class="flex items-center gap-3 border-b border-[#232c40] px-2 py-2.5 text-sm">
              <span class="font-semibold">{{ risk.token }}</span>
              <span class="font-mono text-xs text-slate-500">{{ risk.spender }}</span>
              <span class="ml-auto rounded-full border border-red-900 px-2 py-0.5 text-[11px] text-red-300">Unlimited</span>
            </div>
          </div>
          <button
            class="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3.5 font-bold text-emerald-950 disabled:opacity-60"
            :disabled="state === 'signing' || pendingAction !== null"
            @click="protect"
          >
            {{ state === 'signing' ? 'Confirm in your wallet…' : 'Revoke all — 1 transaction' }}
          </button>
          <p class="mt-3 text-xs leading-relaxed text-slate-500">
            Protection requires approval so Sentrywell can submit revocations on your behalf.
          </p>
        </template>

        <template v-else>
          <h1 class="mt-5 text-2xl font-bold">Protection enabled ✓</h1>
          <p class="mt-3 text-sm text-slate-400">Sentrywell is now monitoring this address. Revocations will process shortly.</p>
        </template>
      </ClientOnly>
    </div>

    <p class="mt-10 text-center">
      <NuxtLink to="/labs/approval-debrief" class="text-[11px] text-slate-600 underline">
        UNSW course participant? Return to the lab
      </NuxtLink>
    </p>
  </div>
</template>
