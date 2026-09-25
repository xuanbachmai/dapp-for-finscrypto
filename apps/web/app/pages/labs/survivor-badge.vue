<script setup lang="ts">
useHead({ title: 'Survivor Credential' })

const {
  isConnected,
  configured,
  labChainId,
  labChainName,
  badgeAddress,
  labComplete,
  badgeId,
  hasClaimedReward,
  pendingAction,
  actionError,
  actionNotice,
  isOnLabChain,
  claimReward,
} = useSurvivorBadge()
const { switchChain } = useWallet()

const explorerBase = 'https://sepolia.etherscan.io'
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Survivor Credential"
      eyebrow="Completion reward"
      :badges="[{ label: 'Week 3', color: 'primary', variant: 'soft' }, { label: 'Separate dapp', color: 'neutral', variant: 'subtle', icon: 'i-lucide-box' }]"
      description="After surviving the Approval & Drain Lab, claim your reward: 500 FINS plus a non-transferable “I Survived” badge with fully on-chain artwork."
    />

    <ClientOnly>
      <UCard v-if="!isConnected" class="border border-white/10 bg-slate-950/70">
        <p class="text-sm text-gray-400">Connect your registered wallet to claim your Survivor credential.</p>
      </UCard>

      <UCard v-else-if="!configured" class="border border-amber-500/20 bg-amber-500/10">
        <p class="text-sm text-amber-100">The Survivor Badge contract has not been deployed or configured on Sepolia yet.</p>
      </UCard>

      <template v-else>
        <div
          v-if="!isOnLabChain"
          class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p><span class="font-medium text-white">Wrong network.</span> Switch your wallet to {{ labChainName }} (chainId {{ labChainId }}).</p>
            <UButton label="Switch network" icon="i-lucide-network" color="warning" variant="soft" @click="switchChain(labChainId)" />
          </div>
        </div>

        <div v-if="actionError" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {{ actionError }}
        </div>
        <div v-if="actionNotice" class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {{ actionNotice }}
        </div>

        <UCard class="border border-white/10 bg-slate-950/70">
          <div class="grid gap-6 md:grid-cols-[280px_1fr] md:items-center">
            <img
              src="/nft/i-survived-a-hack.png"
              alt="I Survived FINSCRYPTO.XYZ completion badge"
              class="mx-auto w-full max-w-[280px] rounded-2xl border border-white/10"
            >
            <div>
              <h2 class="text-lg font-semibold text-white">Your reward</h2>
              <p class="mt-1 text-sm text-gray-400">
                Claiming mints 500 valueless course FINS and one non-transferable Sepolia NFT in a single
                transaction. The badge's metadata and final artwork are stored fully on-chain.
              </p>

              <div v-if="!labComplete" class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                Finish the <NuxtLink to="/labs/approval-debrief" class="text-primary underline underline-offset-4">Approval &amp; Drain Lab</NuxtLink>
                first: get drained, revoke every approval, and recover every token. This page unlocks once the lab reads as complete.
              </div>

              <div v-else-if="hasClaimedReward" class="mt-4 space-y-2">
                <p class="text-sm font-medium text-emerald-300">Reward claimed · survivor badge #{{ badgeId }}</p>
                <a
                  :href="`${explorerBase}/token/${badgeAddress}?a=${badgeId}`"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4"
                >
                  View badge on Etherscan
                  <UIcon name="i-lucide-arrow-up-right" class="size-4" />
                </a>
                <p class="text-sm text-gray-400">Return to <NuxtLink to="/activities" class="text-primary underline underline-offset-4">Activities</NuxtLink> to verify this credential.</p>
              </div>

              <UButton
                v-else
                class="mt-4"
                icon="i-lucide-gift"
                label="Claim 500 FINS + survivor badge"
                :loading="pendingAction === 'reward'"
                :disabled="pendingAction !== null"
                @click="void claimReward()"
              />
            </div>
          </div>
        </UCard>

        <p class="text-xs text-gray-500">
          Prefer not to send your own transaction? Staff can run a sponsored airdrop that mints the reward
          for every eligible wallet.
        </p>
      </template>

      <template #fallback>
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-sm text-gray-400">Loading reward state...</p>
        </UCard>
      </template>
    </ClientOnly>
  </div>
</template>
