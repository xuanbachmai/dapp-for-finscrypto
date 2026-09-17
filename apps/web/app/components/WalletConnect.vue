<script setup lang="ts">
import { supportedChains } from '~/utils/chains'
import { getChainBadge } from '~/utils/chain-ui'

const { address, chainId, isConnected, connect, disconnect, switchChain } = useWallet()
const toast = useToast()

const isSwitchingChain = shallowRef(false)
const lastKnownAddress = shallowRef('')
const lastKnownChainId = shallowRef<number | null>(null)

watch(
  [isConnected, address, chainId],
  ([connected, nextAddress, nextChainId]) => {
    if (!connected) {
      if (!isSwitchingChain.value) {
        lastKnownAddress.value = ''
        lastKnownChainId.value = null
      }

      return
    }

    if (nextAddress) {
      lastKnownAddress.value = nextAddress
    }

    if (typeof nextChainId === 'number') {
      lastKnownChainId.value = nextChainId
    }
  },
  { immediate: true },
)

const displayConnected = computed(() =>
  isConnected.value || (isSwitchingChain.value && Boolean(lastKnownAddress.value)),
)

const displayAddress = computed(() =>
  isConnected.value ? (address.value ?? '') : isSwitchingChain.value ? lastKnownAddress.value : '',
)
const displayChainId = computed(() =>
  isConnected.value ? (chainId.value ?? null) : isSwitchingChain.value ? lastKnownChainId.value : null,
)

const truncatedAddress = computed(() => {
  if (!displayAddress.value) return ''
  return `${displayAddress.value.slice(0, 6)}...${displayAddress.value.slice(-4)}`
})

const currentChainBadge = computed(() => getChainBadge(displayChainId.value))

const chainItems = computed(() =>
  supportedChains.map((c) => ({
    label: c.name,
    icon: 'i-lucide-network',
    disabled: displayChainId.value === c.id || isSwitchingChain.value,
    onSelect: () => handleSwitchChain(c.id),
  })),
)

async function handleSwitchChain(targetChainId: number) {
  if (displayChainId.value === targetChainId || isSwitchingChain.value) {
    return
  }

  isSwitchingChain.value = true

  try {
    await switchChain(targetChainId)
  } catch (error) {
    const description = error instanceof Error ? error.message : 'Unable to switch networks right now.'

    toast.add({
      title: 'Network switch failed',
      description,
      color: 'error',
    })
  } finally {
    isSwitchingChain.value = false
  }
}

async function handleDisconnect() {
  lastKnownAddress.value = ''
  lastKnownChainId.value = null
  isSwitchingChain.value = false
  await disconnect()
}
</script>

<template>
  <div class="flex items-center justify-end gap-2">
    <template v-if="!displayConnected">
      <UButton class="h-9" label="Connect Wallet" icon="i-lucide-wallet" @click="() => connect()" />
    </template>

    <template v-else>
      <UDropdownMenu :items="chainItems" :modal="false">
        <UButton
          :color="currentChainBadge.color"
          :variant="currentChainBadge.variant ?? 'subtle'"
          :icon="currentChainBadge.icon"
          size="sm"
          class="h-9 w-[9.5rem] justify-start px-3"
          :loading="isSwitchingChain"
        >
          <span class="truncate">{{ currentChainBadge.label }}</span>
        </UButton>
      </UDropdownMenu>

      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-user"
        size="sm"
        class="h-9 w-[10.75rem] justify-start px-3"
        :disabled="isSwitchingChain"
      >
        <span class="truncate">{{ truncatedAddress }}</span>
      </UButton>

      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-log-out"
        class="h-9 shrink-0"
        aria-label="Disconnect"
        :disabled="isSwitchingChain"
        @click="handleDisconnect"
      />
    </template>
  </div>
</template>
