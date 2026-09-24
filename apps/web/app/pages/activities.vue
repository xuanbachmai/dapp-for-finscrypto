<script setup lang="ts">
import { ActivityStatusResponseSchema, ActivityVerificationResponseSchema } from '~/utils/schemas'
import { courseActivities, type ActivityId } from '~/utils/activities'
import { getChainBadge } from '~/utils/chain-ui'

useHead({
  title: 'Activities',
})

const config = useRuntimeConfig()
const toast = useToast()
const { address, isConnected } = useWallet()

const statuses = reactive<Record<string, { completed: boolean, verifiedAt: string | null, checking: boolean, error: string }>>(
  Object.fromEntries(courseActivities.map(activity => [activity.id, { completed: false, verifiedAt: null, checking: false, error: '' }])),
)
const studentFound = shallowRef<boolean | null>(null)

async function loadStatuses() {
  if (!address.value) return
  try {
    const response = ActivityStatusResponseSchema.parse(await $fetch('/api/activities', { query: { walletAddress: address.value } }))
    studentFound.value = response.studentFound
    for (const item of response.activities) {
      const status = statuses[item.id]
      if (status) Object.assign(status, { completed: item.completed, verifiedAt: item.verifiedAt })
    }
  } catch (error) {
    studentFound.value = null
    toast.add({ title: 'Progress unavailable', description: error instanceof Error ? error.message : 'Could not load Progress.', color: 'error' })
  }
}

async function verify(id: ActivityId) {
  if (!address.value) return
  const status = statuses[id]!
  status.checking = true
  status.error = ''
  try {
    const response = ActivityVerificationResponseSchema.parse(await $fetch(`/api/activities/verify/${id}`, {
      method: 'POST', body: { walletAddress: address.value },
    }))
    if (response.verified) {
      Object.assign(status, { completed: true, verifiedAt: response.verifiedAt })
      toast.add({ title: 'Activity verified', description: response.message, color: 'success' })
    } else {
      status.error = response.message
    }
  } catch (error: unknown) {
    const data = (error as { data?: { message?: string } })?.data
    status.error = data?.message ?? (error instanceof Error ? error.message : 'Verification failed.')
  } finally {
    status.checking = false
  }
}

watch(address, () => { void loadStatuses() }, { immediate: true })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Activities"
      description="Complete each Activity on-chain, then verify it here. Verification reads chain state on the server and saves your Progress."
    />

    <ClientOnly>
      <UCard v-if="!isConnected" class="border border-white/10 bg-slate-950/70">
        <p class="text-sm text-gray-400">Connect your registered wallet to see and verify your Activities.</p>
      </UCard>

      <div
        v-else-if="studentFound === false"
        class="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100"
      >
        This wallet is not registered on FINSCRYPTO.
        <a :href="`${config.public.platformUrl}/faucet`" target="_blank" rel="noreferrer" class="font-medium underline underline-offset-4">Verify it on the course platform</a>
        before checking Activities.
      </div>

      <div class="space-y-4">
        <UCard v-for="activity in courseActivities" :key="activity.id" class="border border-white/10 bg-slate-950/70">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge :label="`Week ${activity.week}`" color="primary" variant="soft" />
                <UBadge v-bind="getChainBadge(activity.chainId)" />
                <UBadge v-if="statuses[activity.id]?.completed" label="Verified" color="success" variant="subtle" icon="i-lucide-circle-check" />
              </div>
              <h2 class="mt-3 text-lg font-semibold text-white">{{ activity.number }}. {{ activity.title }}</h2>
              <p class="mt-1 text-sm text-gray-400">{{ activity.description }}</p>
              <ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-300">
                <li v-for="requirement in activity.requirements" :key="requirement">{{ requirement }}</li>
              </ol>
              <p v-if="statuses[activity.id]?.error" class="mt-3 text-sm text-red-300">{{ statuses[activity.id]?.error }}</p>
              <p v-if="statuses[activity.id]?.verifiedAt" class="mt-3 text-xs text-gray-500">
                Verified {{ new Date(statuses[activity.id]!.verifiedAt!).toLocaleString('en-AU') }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <UButton :to="activity.dappPath" variant="outline" color="neutral" icon="i-lucide-arrow-up-right" label="Open" />
              <UButton
                icon="i-lucide-badge-check"
                label="Verify"
                :loading="statuses[activity.id]?.checking"
                :disabled="!isConnected"
                @click="verify(activity.id)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </ClientOnly>
  </div>
</template>
