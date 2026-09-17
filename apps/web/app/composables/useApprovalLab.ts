import { useReadContract } from '@wagmi/vue'
import { maxUint256 } from 'viem'
import { computed } from 'vue'
import { useWagmiChainWriter } from '~/lib/chain-action/wagmi'
import { LAB_CHAIN_ID, supportedChains, type SupportedChainId } from '~/utils/chains'
import { approvalLabChainIds, getContract } from '~/utils/contracts'
import { ApprovalLabProgressSchema, type ChainActionRequest } from '~/utils/schemas'
import { useChainAction } from './useChainAction'
import { useWallet } from './useWallet'

const READ_REFRESH_INTERVAL_MS = 4_000

export function useApprovalLab() {
  const wallet = useWallet()
  const { address, isConnected } = wallet

  // The lab runs on whichever lab Chain the wallet is on (local Anvil, FINSCRYPTO once
  // deployed). Anywhere else, pages fall back to the default lab Chain and prompt a switch.
  const labChainId = computed<SupportedChainId>(() => {
    const current = wallet.chainId.value as SupportedChainId | undefined
    return current && approvalLabChainIds.includes(current) ? current : LAB_CHAIN_ID
  })
  const labChainName = computed(() => supportedChains.find(chain => chain.id === labChainId.value)?.name ?? `Chain ${labChainId.value}`)
  const contract = (name: string) => getContract(name, labChainId.value)

  // Chain actions resolve wagmi during setup, so build one per lab Chain up front.
  const actions = new Map(approvalLabChainIds.map(chainId => [chainId, useChainAction('approvalLab', chainId, {
    wallet,
    writer: useWagmiChainWriter(chainId),
    messages: { submitted: 'Submitted. Waiting for confirmation...', confirmed: 'Confirmed on-chain.' },
  })]))
  const action = computed(() => actions.get(labChainId.value)!)

  const read = (name: string, functionName: string, extra: { refetch?: boolean } = { refetch: true }) =>
    useReadContract(computed(() => ({
      ...contract(name),
      chainId: labChainId.value,
      functionName,
      args: address.value ? [address.value] : undefined,
      query: { enabled: Boolean(address.value), refetchInterval: extra.refetch ? READ_REFRESH_INTERVAL_MS : false },
    })))

  const progressQuery = read('approvalLab', 'progressOf')
  const drainedQuery = read('drainerRound1', 'drainedAmount')
  const owedRound1Query = read('drainerRound1', 'owedTo')
  const owedRound2Query = read('drainerRound2', 'owedTo')
  const balanceQuery = read('labAud', 'balanceOf')
  const hasClaimedQuery = read('labAud', 'hasClaimed', { refetch: false })

  const progress = computed(() => {
    const parsed = ApprovalLabProgressSchema.safeParse(progressQuery.data.value)
    return parsed.success ? parsed.data : null
  })
  const drainedAmount = computed(() => (drainedQuery.data.value as bigint | undefined) ?? 0n)
  const owedRound1 = computed(() => (owedRound1Query.data.value as bigint | undefined) ?? 0n)
  const owedRound2 = computed(() => (owedRound2Query.data.value as bigint | undefined) ?? 0n)
  const owedTotal = computed(() => owedRound1.value + owedRound2.value)
  const balance = computed(() => (balanceQuery.data.value as bigint | undefined) ?? 0n)
  const hasClaimedFaucet = computed(() => Boolean(hasClaimedQuery.data.value))
  const hasOpenLabApproval = computed(() => (progress.value?.round1Allowance ?? 0n) > 0n || (progress.value?.round2Allowance ?? 0n) > 0n)

  const pendingAction = computed(() => action.value.pending.value)
  const actionError = computed(() => action.value.error.value)
  const actionNotice = computed(() => action.value.notice.value)
  const isOnLabChain = computed(() => action.value.isOnSupportedChain.value)

  async function refresh() {
    await Promise.allSettled([progressQuery, drainedQuery, owedRound1Query, owedRound2Query, balanceQuery, hasClaimedQuery]
      .map(query => query.refetch()))
  }

  async function runAndRefresh(label: string, request: ChainActionRequest) {
    try {
      await action.value.run(label, request)
      return true
    } catch {
      // Chain action exposes the failure through actionError for the page.
      return false
    } finally {
      await refresh()
    }
  }

  /** Student self-service refund from every drainer that still owes them. */
  async function claimRefund() {
    const token = contract('labAud').address
    for (const [name, owed] of [['drainerRound1', owedRound1], ['drainerRound2', owedRound2]] as const) {
      if (owed.value > 0n && !await runAndRefresh('refund', { contract: name, functionName: 'claimRefund', args: [token] })) return false
    }
    return true
  }

  /**
   * Sets the wallet's own allowance to zero for both lab drainers. A contract cannot do this
   * for the Student: only the wallet that granted an approval can revoke it.
   */
  async function revokeLabApprovals() {
    for (const [name, allowance] of [
      ['drainerRound1', progress.value?.round1Allowance ?? 0n],
      ['drainerRound2', progress.value?.round2Allowance ?? 0n],
    ] as const) {
      if (allowance === 0n) continue
      const ok = await runAndRefresh('revoke', { contract: 'labAud', functionName: 'approve', args: [contract(name).address, 0n] })
      if (!ok) return false
    }
    return true
  }

  return {
    address,
    isConnected,
    labChainId,
    labChainName,
    contracts: computed(() => ({
      lab: contract('approvalLab'),
      token: contract('labAud'),
      drainerRound1: contract('drainerRound1'),
      drainerRound2: contract('drainerRound2'),
    })),
    progress,
    drainedAmount,
    owedRound1,
    owedRound2,
    owedTotal,
    balance,
    hasClaimedFaucet,
    hasOpenLabApproval,
    pendingAction,
    actionError,
    actionNotice,
    isOnLabChain,
    refresh,
    claimRefund,
    revokeLabApprovals,
    claimFaucet: () => runAndRefresh('faucet', { contract: 'labAud', functionName: 'claimFaucet' }),
    completeRecovery: () => runAndRefresh('recovery', { functionName: 'completeRecovery' }),
    enterRound2: () => runAndRefresh('round2', { functionName: 'enterRound2' }),
    // The lure pages. The wallet prompt is honest: unlimited approval to a drainer.
    approveRound1Lure: () => runAndRefresh('lure-approve', {
      contract: 'labAud', functionName: 'approve', args: [contract('drainerRound1').address, maxUint256],
    }),
    claimLure: () => runAndRefresh('lure-claim', { contract: 'fakeAirdrop', functionName: 'claim' }),
    approveRound2Lure: () => runAndRefresh('lure-approve', {
      contract: 'labAud', functionName: 'approve', args: [contract('drainerRound2').address, maxUint256],
    }),
  }
}
