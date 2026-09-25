<script setup lang="ts">
import { LAB_CHAIN, LAB_CHAIN_ID } from '~/utils/chains'

useHead({ title: 'Sepolia ETH Faucet | FINSCRYPTO.XYZ' })

const { address, chainId, isConnected, connect, switchChain } = useWallet()
const copied = ref(false)
const isOnSepolia = computed(() => chainId.value === LAB_CHAIN_ID)
const explorerUrl = computed(() => address.value
  ? `${LAB_CHAIN.blockExplorers.default.url}/address/${address.value}`
  : LAB_CHAIN.blockExplorers.default.url)

const faucets = [
  {
    name: 'Google Cloud faucet',
    description: 'Request Sepolia ETH from Google Cloud Web3.',
    href: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
  },
  {
    name: 'Alchemy faucet',
    description: 'Request 0.1 Sepolia ETH; eligibility limits may apply.',
    href: 'https://www.alchemy.com/faucets/ethereum-sepolia',
  },
  {
    name: 'All Sepolia faucets',
    description: 'Open the maintained faucet list on ethereum.org.',
    href: 'https://ethereum.org/developers/docs/networks/#sepolia',
  },
] as const

async function copyWallet() {
  if (!address.value) return
  await navigator.clipboard.writeText(address.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1_500)
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <PageHeader
      title="Get Sepolia ETH"
      eyebrow="Transaction fees"
      description="Sepolia ETH pays gas for the classroom contracts. It is test currency and has no real-world value."
      :badges="[{ label: `Sepolia · Chain ${LAB_CHAIN_ID}`, color: 'info', variant: 'soft' }]"
    />

    <ClientOnly>
      <UCard class="border border-white/10 bg-slate-950/70">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex items-start gap-4">
            <div class="rounded-2xl bg-primary/10 p-3">
              <UIcon name="i-lucide-fuel" class="size-7 text-primary" />
            </div>
            <div>
              <h2 class="text-xl font-semibold text-white">Your gas wallet</h2>
              <p class="mt-1 text-sm text-gray-400">Connect the same wallet you will use for the FINS classroom exercise.</p>
            </div>
          </div>
          <UBadge
            :color="isOnSepolia ? 'success' : 'neutral'"
            variant="subtle"
            :label="isOnSepolia ? 'Sepolia connected' : 'Sepolia required'"
          />
        </div>

        <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Destination wallet</p>
          <p class="mt-2 break-all font-mono text-sm text-white">{{ address || 'Connect a wallet to continue.' }}</p>
          <div v-if="address" class="mt-3 flex flex-wrap gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? 'Copied' : 'Copy address'"
              @click="void copyWallet()"
            />
            <UButton
              :to="explorerUrl"
              target="_blank"
              rel="noreferrer"
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-external-link"
              label="View on Sepolia Etherscan"
            />
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <UButton
            v-if="!isConnected"
            size="lg"
            icon="i-lucide-wallet"
            label="Connect wallet"
            @click="void connect(LAB_CHAIN_ID)"
          />
          <UButton
            v-else-if="!isOnSepolia"
            size="lg"
            icon="i-lucide-refresh-cw"
            label="Switch to Sepolia"
            @click="void switchChain(LAB_CHAIN_ID)"
          />
        </div>
      </UCard>

      <template #fallback>
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-sm text-gray-400">Loading wallet state...</p>
        </UCard>
      </template>
    </ClientOnly>

    <div class="grid gap-4 sm:grid-cols-3">
      <UCard v-for="faucet in faucets" :key="faucet.href" class="border border-white/10 bg-slate-950/70">
        <h2 class="font-semibold text-white">{{ faucet.name }}</h2>
        <p class="mt-2 min-h-12 text-sm text-gray-400">{{ faucet.description }}</p>
        <UButton
          :to="faucet.href"
          target="_blank"
          rel="noreferrer"
          class="mt-4"
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-up-right"
          label="Open faucet"
        />
      </UCard>
    </div>

    <UAlert
      color="warning"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Sepolia ETH and FINS are different"
      description="Sepolia ETH pays network fees. FINS is the valueless ERC-20 classroom token used inside the approval lesson. Neither should be purchased or treated as real money."
    />
  </div>
</template>
