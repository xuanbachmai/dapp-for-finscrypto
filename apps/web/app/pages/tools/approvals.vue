<script setup lang="ts">
import { approvalId, formatAllowance, formatTokenAmount } from '~/lib/approvals-scan'
import { supportedChains } from '~/utils/chains'
import { getChainBadge } from '~/utils/chain-ui'

useHead({
  title: 'Approvals',
})

const {
  isConnected,
  selectedChainIds,
  approvals,
  scanning,
  scanned,
  status,
  failures,
  revoking,
  revokeError,
  unlimitedCount,
  atRiskCount,
  scan,
  revoke,
} = useApprovals()

function toggleChain(id: (typeof supportedChains)[number]['id'], checked: boolean | 'indeterminate') {
  selectedChainIds.value = checked === true
    ? [...selectedChainIds.value, id]
    : selectedChainIds.value.filter(item => item !== id)
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Approvals"
      eyebrow="Tool"
      description="Every spender your wallet has permitted to move its tokens, across the course Chains, with one-click revoke. No on-chain call lists these; they are found in event history and re-checked against current state."
    />

    <ClientOnly>
      <UCard v-if="!isConnected" class="border border-white/10 bg-slate-950/70">
        <p class="text-sm text-gray-400">Connect your wallet from the navigation bar to scan its approvals.</p>
      </UCard>

      <template v-else>
        <UCard class="border border-white/10 bg-slate-950/70">
          <div class="flex flex-wrap items-center gap-4">
            <UCheckbox
              v-for="chain in supportedChains"
              :key="chain.id"
              :label="chain.name"
              :model-value="selectedChainIds.includes(chain.id)"
              @update:model-value="checked => toggleChain(chain.id, checked)"
            />
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-3">
            <UButton
              icon="i-lucide-scan-search"
              :label="scanning ? 'Scanning...' : 'Scan for approvals'"
              :loading="scanning"
              :disabled="selectedChainIds.length === 0"
              @click="scan"
            />
            <span v-if="status" class="text-sm text-gray-400">{{ status }}</span>
          </div>

          <p class="mt-4 text-xs text-gray-500">
            Scans roughly the last 500,000 blocks on each Chain. Public RPCs limit how much history one request can return, so the scan splits the range automatically. A slow scan is the RPC being careful.
          </p>
        </UCard>

        <div
          v-for="failure in failures"
          :key="failure"
          class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {{ failure }}. Approvals on this Chain were not checked, so an empty result here does not mean the wallet is clean.
        </div>

        <div
          v-if="revokeError"
          class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {{ revokeError }}
        </div>

        <UCard v-if="approvals.length > 0" class="border border-white/10 bg-slate-950/70">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-white">{{ approvals.length }} open approval{{ approvals.length === 1 ? '' : 's' }}</h2>
              <UBadge v-if="unlimitedCount" color="error" variant="subtle" :label="`${unlimitedCount} unlimited`" />
              <UBadge v-if="atRiskCount" color="warning" variant="subtle" :label="`${atRiskCount} over assets you hold`" />
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-white/10 text-left text-xs uppercase tracking-[0.12em] text-gray-500">
                  <th class="py-2 pr-4 font-medium">Asset</th>
                  <th class="py-2 pr-4 font-medium">Chain</th>
                  <th class="py-2 pr-4 font-medium">Spender</th>
                  <th class="py-2 pr-4 font-medium">Approved</th>
                  <th class="py-2 pr-4 font-medium">You hold</th>
                  <th class="py-2" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="approval in approvals" :key="approvalId(approval)" class="border-b border-white/5">
                  <td class="py-3 pr-4">
                    <span class="font-medium text-white">{{ approval.symbol }}</span>
                    <p class="font-mono text-xs text-gray-500">{{ shortAddress(approval.token) }}</p>
                  </td>
                  <td class="py-3 pr-4">
                    <UBadge v-bind="getChainBadge(approval.chainId)" />
                  </td>
                  <td class="py-3 pr-4 font-mono text-xs text-gray-300">{{ shortAddress(approval.spender) }}</td>
                  <td class="py-3 pr-4">
                    <UBadge
                      v-if="approval.unlimited || approval.kind === 'nft'"
                      color="error"
                      variant="subtle"
                      :label="formatAllowance(approval)"
                    />
                    <span v-else class="text-gray-300">{{ formatAllowance(approval) }}</span>
                  </td>
                  <td class="py-3 pr-4" :class="approval.balance > 0n ? 'text-white' : 'text-gray-500'">
                    {{ approval.kind === 'nft' ? '—' : `${formatTokenAmount(approval.balance, approval.decimals)} ${approval.symbol}` }}
                  </td>
                  <td class="py-3 text-right">
                    <UButton
                      color="error"
                      variant="soft"
                      size="sm"
                      label="Revoke"
                      :loading="revoking === approvalId(approval)"
                      :disabled="revoking !== null"
                      @click="revoke(approval)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="mt-4 text-xs text-gray-500">
            Each revoke is its own transaction and costs gas. That cost is why people put it off, and putting it off is why drains keep working.
          </p>
        </UCard>

        <UCard v-else-if="scanned && failures.length === 0" class="border border-white/10 bg-slate-950/70">
          <p class="font-medium text-white">No open approvals found.</p>
          <p class="mt-1 text-sm text-gray-400">Every approval this wallet granted in the scanned window has been revoked or spent down to zero.</p>
        </UCard>
      </template>

      <template #fallback>
        <UCard class="border border-white/10 bg-slate-950/70">
          <p class="text-sm text-gray-400">Loading approvals tool...</p>
        </UCard>
      </template>
    </ClientOnly>
  </div>
</template>
