<script setup lang="ts">
import { formatTokenAmount } from '~/lib/approvals-scan'

const {
  address,
  isConnected,
  contracts,
  progress,
  labChainId,
  labChainName,
  drainedAmount,
  owedTotal,
  balance,
  hasClaimedFaucet,
  hasOpenLabApproval,
  pendingAction,
  actionError,
  actionNotice,
  isOnLabChain,
  refresh,
  claimFaucet,
  completeRecovery,
  enterRound2,
  claimRefund,
  revokeLabApprovals,
} = useApprovalLab()
const { switchChain } = useWallet()

const calldata = computed(() => [
  '0x095ea7b3',
  contracts.value.drainerRound1.address.toLowerCase().replace('0x', '0'.repeat(24)),
  'f'.repeat(64),
])

const steps = computed(() => {
  const p = progress.value
  return [
    { key: 'drained', done: Boolean(p?.drained), title: 'Round 1: you signed the approval and were drained', detail: 'The only step you complete by failing.' },
    { key: 'revoked', done: Boolean(p?.revoked), title: 'Recovery: revoke every lab approval, then confirm', detail: 'Your exposure time runs from the drain to this confirmation.' },
    { key: 'round2Started', done: Boolean(p?.round2Started), title: 'Round 2: start it, then visit the second lure', detail: 'Starting writes a block number on-chain. That block is what makes “you did not sign” provable later.' },
    { key: 'round2Tested', done: Boolean(p?.round2Tested), title: 'Round 2 tested: staff ran the drain attempt', detail: p?.round2Started && !p.round2Tested ? 'Waiting for staff. Not being attacked is not the same as resisting an attack, so this cannot pass until the attempt runs.' : 'The attempt ran after you started.' },
    { key: 'round2Passed', done: Boolean(p?.round2Passed), title: 'Round 2 passed: it came away with nothing', detail: p?.round2Tested && !p.round2Passed ? 'It got you again. Revoke, confirm, and start round 2 again.' : 'You refused the second signature.' },
    { key: 'complete', done: Boolean(p?.complete), title: 'Complete: verify on the Activities page', detail: p?.complete ? `Exposure: ${p.secondsExposed} seconds between the drain and your confirmed revoke.` : 'Every lab allowance must also still be zero when you verify.' },
  ]
})
</script>

<template>
  <div class="space-y-6">
    <UCard v-if="!isConnected" class="border border-white/10 bg-slate-950/70">
      <p class="text-sm text-gray-400">Connect your registered wallet from the navigation bar to see your lab progress.</p>
    </UCard>

    <template v-else>
      <div
        v-if="!isOnLabChain"
        class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p><span class="font-medium text-white">Lab Chain required.</span> Switch your wallet to {{ labChainName }} (chainId {{ labChainId }}).</p>
          <UButton label="Switch network" icon="i-lucide-network" color="warning" variant="soft" @click="switchChain(labChainId)" />
        </div>
      </div>

      <div
        v-if="progress?.drained"
        class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
      >
        <p class="font-medium text-white">{{ formatTokenAmount(drainedAmount, 18) }} LAUD was taken from your wallet.</p>
        <p class="mt-1">It is owed back to you. In the real version of this, that sentence does not appear.</p>
      </div>

      <UCard v-if="owedTotal > 0n || hasOpenLabApproval" class="border border-white/10 bg-slate-950/70">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="min-w-0">
            <h2 class="font-semibold text-white">Undo the damage</h2>
            <p class="mt-1 text-sm text-gray-400">
              <template v-if="owedTotal > 0n">The lab owes you {{ formatTokenAmount(owedTotal, 18) }} LAUD. </template>
              <template v-if="hasOpenLabApproval">A lab drainer can still move your LAUD; revoke first, or a refund can be swept straight back.</template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="hasOpenLabApproval"
              color="error"
              variant="soft"
              icon="i-lucide-shield-off"
              label="Revoke lab approvals"
              :loading="pendingAction === 'revoke'"
              :disabled="pendingAction !== null"
              @click="void revokeLabApprovals()"
            />
            <UButton
              v-if="owedTotal > 0n"
              icon="i-lucide-undo-2"
              label="Get my LAUD back"
              :loading="pendingAction === 'refund'"
              :disabled="pendingAction !== null"
              @click="void claimRefund()"
            />
          </div>
        </div>
      </UCard>

      <div v-if="actionError" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
        {{ actionError }}
      </div>
      <div v-if="actionNotice" class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        {{ actionNotice }}
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-xs uppercase tracking-[0.18em] text-gray-500">LAUD balance</p>
          <p class="mt-3 text-3xl font-semibold text-white">{{ formatTokenAmount(balance, 18) }}</p>
          <UButton
            v-if="!hasClaimedFaucet"
            class="mt-3"
            size="sm"
            icon="i-lucide-droplets"
            label="Claim 5,000 LAUD"
            :loading="pendingAction === 'faucet'"
            :disabled="pendingAction !== null"
            @click="void claimFaucet()"
          />
          <p v-else class="mt-2 text-sm text-gray-400">A worthless lab token. Refunded after the session.</p>
        </UCard>
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Round-1 drainer allowance</p>
          <p class="mt-3 text-2xl font-semibold" :class="(progress?.round1Allowance ?? 0n) > 0n ? 'text-red-300' : 'text-white'">
            {{ (progress?.round1Allowance ?? 0n) > 0n ? 'Still open' : 'Zero' }}
          </p>
          <p class="mt-2 font-mono text-xs text-gray-500">{{ contracts.drainerRound1.address }}</p>
        </UCard>
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Round-2 drainer allowance</p>
          <p class="mt-3 text-2xl font-semibold" :class="(progress?.round2Allowance ?? 0n) > 0n ? 'text-red-300' : 'text-white'">
            {{ (progress?.round2Allowance ?? 0n) > 0n ? 'Still open' : 'Zero' }}
          </p>
          <p class="mt-2 font-mono text-xs text-gray-500">{{ contracts.drainerRound2.address }}</p>
        </UCard>
      </div>

      <UCard class="border border-white/10 bg-slate-950/70">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-white">Your progress</h2>
            <UButton variant="outline" color="neutral" icon="i-lucide-refresh-cw" label="Refresh" @click="refresh" />
          </div>
        </template>

        <ol class="space-y-4">
          <li v-for="step in steps" :key="step.key" class="flex gap-3">
            <UIcon
              :name="step.done ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              class="mt-0.5 size-5 shrink-0"
              :class="step.done ? 'text-primary' : 'text-gray-600'"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-white">{{ step.title }}</p>
              <p class="mt-0.5 text-sm text-gray-400">{{ step.detail }}</p>

              <div v-if="step.key === 'revoked' && !step.done" class="mt-3 flex flex-wrap gap-2">
                <UButton to="/tools/approvals" size="sm" variant="outline" color="neutral" icon="i-lucide-shield-check" label="Open Approvals" />
                <UButton
                  size="sm"
                  label="Confirm revoked"
                  :loading="pendingAction === 'recovery'"
                  :disabled="!progress?.drained || pendingAction !== null"
                  @click="void completeRecovery()"
                />
              </div>

              <div v-if="step.key === 'round2Started'" class="mt-3 flex flex-wrap gap-2">
                <UButton
                  size="sm"
                  :label="progress?.round2Started ? 'Restart round 2' : 'Start round 2'"
                  :loading="pendingAction === 'round2'"
                  :disabled="!progress?.revoked || pendingAction !== null"
                  @click="void enterRound2()"
                />
                <UButton v-if="progress?.round2Started" to="/labs/verify-wallet" size="sm" variant="soft" label="Go to the second lure" />
              </div>

              <UButton v-if="step.key === 'complete' && step.done" to="/activities" class="mt-3" size="sm" icon="i-lucide-badge-check" label="Verify Activity" />
            </div>
          </li>
        </ol>
      </UCard>
    </template>

    <UCard class="border border-white/10 bg-slate-950/70">
      <template #header>
        <h2 class="text-lg font-semibold text-white">The prompt you signed</h2>
        <p class="mt-1 text-sm text-gray-400">
          Your wallet did not lie. It said you were granting a spending allowance. This is the calldata it described.
        </p>
      </template>
      <pre class="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-6 text-gray-300">{{ calldata.join('\n') }}</pre>
      <dl class="mt-4 space-y-3 text-sm">
        <div class="grid gap-1 md:grid-cols-[8rem_1fr]">
          <dt class="font-mono text-primary">0x095ea7b3</dt>
          <dd class="text-gray-300"><code>approve(address,uint256)</code>, the ERC-20 function that lets another address move your tokens.</dd>
        </div>
        <div class="grid gap-1 md:grid-cols-[8rem_1fr]">
          <dt class="font-mono text-primary">arg 1</dt>
          <dd class="text-gray-300">The spender, <span class="font-mono">{{ contracts.drainerRound1.address }}</span>: a contract you did not read, deployed by someone you cannot name.</dd>
        </div>
        <div class="grid gap-1 md:grid-cols-[8rem_1fr]">
          <dt class="font-mono text-primary">arg 2</dt>
          <dd class="text-gray-300"><code>2²⁵⁶ − 1</code>. Not 5,000 and not your balance: every token of this kind you hold now or later, until you revoke.</dd>
        </div>
      </dl>
      <p class="mt-4 text-sm text-gray-400">
        Nothing here is a bug. ERC-20 worked exactly as specified. The vulnerability was the thirty seconds of trust the page bought.
      </p>
    </UCard>

    <UCard class="border border-white/10 bg-slate-950/70">
      <h2 class="text-lg font-semibold text-white">Outside this room</h2>
      <p class="mt-2 text-sm text-gray-400">
        Unlimited-approval drains and signature phishing are how retail users actually lose money: a convincing page, a routine prompt, and a signature that does far more than it appears to. Vigilance fails; you were vigilant ten minutes ago. Habit works: approve finite amounts where the app allows it, and check your approvals on a schedule, the way you check a bank statement.
      </p>
      <p v-if="address" class="mt-3 text-xs text-gray-500">
        Opting out of this lab? Tell your tutor. Staff can record an equivalent written task against your wallet.
      </p>
    </UCard>
  </div>
</template>
