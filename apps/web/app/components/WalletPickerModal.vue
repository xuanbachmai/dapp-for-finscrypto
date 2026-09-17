<script setup lang="ts">
const {
  cancelConnect,
  connectWith,
  connectorOptions,
  pendingConnectorId,
  pickerError,
  pickerOpen,
} = useWallet()

interface ResolvedConnectorOption {
  id: string
  label: string
  description: string
  icon: string
}

const resolvedOptions = ref<ResolvedConnectorOption[]>([])
const resolvingOptions = ref(false)
const isConnecting = computed(() => Boolean(pendingConnectorId.value))

async function refreshResolvedOptions() {
  if (!import.meta.client || !pickerOpen.value) {
    resolvedOptions.value = []
    return
  }

  resolvingOptions.value = true

  try {
    const nextOptions = await Promise.all(connectorOptions.value.map(async (option) => {
      if (option.id === 'walletConnect') {
        return {
          id: option.id,
          label: option.label,
          description: option.description,
          icon: option.icon,
        } satisfies ResolvedConnectorOption
      }

      const provider = await option.connector.getProvider().catch(() => undefined)
      if (!provider) {
        return null
      }

      return {
        id: option.id,
        label: option.label,
        description: option.description,
        icon: option.icon,
      } satisfies ResolvedConnectorOption
    }))

    resolvedOptions.value = nextOptions.filter((option): option is ResolvedConnectorOption => option !== null)
  } finally {
    resolvingOptions.value = false
  }
}

function handleOpenChange(open: boolean) {
  if (open) {
    pickerOpen.value = true
    return
  }

  if (!isConnecting.value) {
    cancelConnect()
  }
}

async function handleConnect(connectorId: string) {
  await connectWith(connectorId)
}

watch(
  () => [pickerOpen.value, connectorOptions.value.map(option => option.id).join('|')] as const,
  async ([isOpen]) => {
    if (!isOpen) {
      resolvedOptions.value = []
      return
    }

    await refreshResolvedOptions()
  },
  { immediate: true },
)
</script>

<template>
  <UModal
    :open="pickerOpen"
    title="Connect Wallet"
    description="Choose how you want to connect to the course platform."
    :ui="{ overlay: 'z-[60]', content: 'z-[60]' }"
    :dismissible="!isConnecting"
    @update:open="handleOpenChange"
  >
    <template #body>
      <div class="space-y-4">
        <div
          v-if="pickerError"
          class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {{ pickerError }}
        </div>

        <div
          v-if="resolvingOptions"
          class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400"
        >
          Checking available wallet connectors...
        </div>

        <div
          v-else-if="resolvedOptions.length === 0"
          class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300"
        >
          No supported wallets are currently available. Install MetaMask or another browser wallet, or use WalletConnect if it is enabled for this environment.
        </div>

        <div v-else class="space-y-3">
          <UButton
            v-for="option in resolvedOptions"
            :key="option.id"
            block
            color="neutral"
            variant="outline"
            class="justify-start rounded-2xl border-white/10 px-4 py-4 text-left"
            :loading="pendingConnectorId === option.id"
            :disabled="isConnecting"
            @click="handleConnect(option.id)"
          >
            <div class="flex w-full items-start gap-3">
              <span class="mt-0.5 rounded-xl bg-white/5 p-2 text-gray-200">
                <UIcon :name="option.icon" class="size-5" />
              </span>

              <div class="min-w-0">
                <p class="font-medium text-white">{{ option.label }}</p>
                <p class="mt-1 text-sm text-gray-400">{{ option.description }}</p>
              </div>
            </div>
          </UButton>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="isConnecting"
          @click="cancelConnect"
        />
      </div>
    </template>
  </UModal>
</template>
