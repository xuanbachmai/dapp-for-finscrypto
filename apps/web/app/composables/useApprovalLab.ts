import { useReadContract } from '@wagmi/vue'
import { maxUint256 } from 'viem'
import { computed } from 'vue'
import { useWagmiChainWriter } from '~/lib/chain-action/wagmi'
import { LAB_CHAIN, LAB_CHAIN_ID } from '~/utils/chains'
import { areLabContractsConfigured, createLabContracts, getLabContract, type LabContractName } from '~/utils/contracts'
import { ApprovalLabProgressSchema, type ChainActionRequest } from '~/utils/schemas'
import { useChainAction } from './useChainAction'
import { useWallet } from './useWallet'

const READ_REFRESH_INTERVAL_MS = 4_000

export function useApprovalLab() {
  const wallet = useWallet()
  const { address, isConnected } = wallet
  const config = useRuntimeConfig()
  const labChainId = computed(() => LAB_CHAIN_ID)
  const labChainName = computed(() => LAB_CHAIN.name)
  const configuredContracts = createLabContracts(config.public.labContracts)
  const labConfigured = areLabContractsConfigured(configuredContracts)
  const contract = (name: LabContractName) => getLabContract(configuredContracts, name)
  const configurationError = shallowRef('')

  const action = useChainAction(contract('approvalLab'), LAB_CHAIN_ID, {
    wallet,
    writer: useWagmiChainWriter(LAB_CHAIN_ID),
    resolveContract: name => contract(name as LabContractName),
    messages: { submitted: 'Submitted. Waiting for confirmation...', confirmed: 'Confirmed on-chain.' },
  })

  const read = (name: LabContractName, functionName: string, extra: { refetch?: boolean } = { refetch: true }) =>
    useReadContract(computed(() => ({
      ...contract(name),
      chainId: labChainId.value,
      functionName,
      args: address.value ? [address.value] : undefined,
      query: { enabled: Boolean(address.value) && labConfigured, refetchInterval: extra.refetch ? READ_REFRESH_INTERVAL_MS : false },
    })))

  const progressQuery = read('approvalLab', 'progressOf')
  const badgeQuery = read('approvalLab', 'badgeOf')
  const drainedFinsQuery = read('drainerRound1', 'drainedAmount')
  const drainedAudQuery = read('audDrainerRound1', 'drainedAmount')
  const owedFinsRound1Query = read('drainerRound1', 'owedTo')
  const owedFinsRound2Query = read('drainerRound2', 'owedTo')
  const owedAudRound1Query = read('audDrainerRound1', 'owedTo')
  const owedAudRound2Query = read('audDrainerRound2', 'owedTo')
  const balanceQuery = read('finsToken', 'balanceOf')
  const audBalanceQuery = read('audToken', 'balanceOf')
  const hasClaimedQuery = read('finsToken', 'hasClaimed', { refetch: false })

  const progress = computed(() => {
    const parsed = ApprovalLabProgressSchema.safeParse(progressQuery.data.value)
    return parsed.success ? parsed.data : null
  })
  const asAmount = (value: unknown) => (value as bigint | undefined) ?? 0n
  const drainedFins = computed(() => asAmount(drainedFinsQuery.data.value))
  const drainedAud = computed(() => asAmount(drainedAudQuery.data.value))
  const owedFins = computed(() => asAmount(owedFinsRound1Query.data.value) + asAmount(owedFinsRound2Query.data.value))
  const owedAud = computed(() => asAmount(owedAudRound1Query.data.value) + asAmount(owedAudRound2Query.data.value))
  const hasAnyOwed = computed(() => owedFins.value > 0n || owedAud.value > 0n)
  const balance = computed(() => asAmount(balanceQuery.data.value))
  const audBalance = computed(() => asAmount(audBalanceQuery.data.value))
  const badgeId = computed(() => asAmount(badgeQuery.data.value))
  const hasClaimedReward = computed(() => badgeId.value > 0n)
  const hasClaimedFaucet = computed(() => Boolean(hasClaimedQuery.data.value))
  const hasOpenLabApproval = computed(() => {
    const p = progress.value
    return (p?.round1Allowance ?? 0n) > 0n
      || (p?.round2Allowance ?? 0n) > 0n
      || (p?.audRound1Allowance ?? 0n) > 0n
      || (p?.audRound2Allowance ?? 0n) > 0n
  })

  const pendingAction = computed(() => action.pending.value)
  const actionError = computed(() => configurationError.value || action.error.value)
  const actionNotice = computed(() => action.notice.value)
  const isOnLabChain = computed(() => action.isOnSupportedChain.value)

  const queries = [
    progressQuery,
    badgeQuery,
    drainedFinsQuery,
    drainedAudQuery,
    owedFinsRound1Query,
    owedFinsRound2Query,
    owedAudRound1Query,
    owedAudRound2Query,
    balanceQuery,
    audBalanceQuery,
    hasClaimedQuery,
  ]

  async function refresh() {
    await Promise.allSettled(queries.map(query => query.refetch()))
  }

  async function runAndRefresh(label: string, request: ChainActionRequest) {
    if (!labConfigured) {
      configurationError.value = 'The Approval Lab contracts have not been deployed or configured on Sepolia yet.'
      return false
    }
    configurationError.value = ''
    try {
      await action.run(label, request)
      return true
    }
    catch {
      return false
    }
    finally {
      await refresh()
    }
  }

  /** Student self-service refund from every FINS and AUD drainer that still owes them. */
  async function claimRefund() {
    const refunds: Array<{ drainer: LabContractName, owed: bigint }> = [
      { drainer: 'drainerRound1', owed: asAmount(owedFinsRound1Query.data.value) },
      { drainer: 'drainerRound2', owed: asAmount(owedFinsRound2Query.data.value) },
      { drainer: 'audDrainerRound1', owed: asAmount(owedAudRound1Query.data.value) },
      { drainer: 'audDrainerRound2', owed: asAmount(owedAudRound2Query.data.value) },
    ]
    for (const refund of refunds) {
      if (refund.owed > 0n && !await runAndRefresh('refund', { contract: refund.drainer, functionName: 'claimRefund' })) return false
    }
    return true
  }

  /** Only the Student wallet can set each FINS/AUD allowance back to zero. */
  async function revokeLabApprovals() {
    const p = progress.value
    const approvals: Array<{ token: LabContractName, drainer: LabContractName, allowance: bigint }> = [
      { token: 'finsToken', drainer: 'drainerRound1', allowance: p?.round1Allowance ?? 0n },
      { token: 'finsToken', drainer: 'drainerRound2', allowance: p?.round2Allowance ?? 0n },
      { token: 'audToken', drainer: 'audDrainerRound1', allowance: p?.audRound1Allowance ?? 0n },
      { token: 'audToken', drainer: 'audDrainerRound2', allowance: p?.audRound2Allowance ?? 0n },
    ]
    for (const approval of approvals) {
      if (approval.allowance === 0n) continue
      const ok = await runAndRefresh('revoke', {
        contract: approval.token,
        functionName: 'approve',
        args: [contract(approval.drainer).address, 0n],
      })
      if (!ok) return false
    }
    return true
  }

  async function approveRound1Lure() {
    const approvals: Array<{ token: LabContractName, drainer: LabContractName }> = [
      { token: 'finsToken', drainer: 'drainerRound1' },
      { token: 'audToken', drainer: 'audDrainerRound1' },
    ]

    for (const approval of approvals) {
      const ok = await runAndRefresh('lure-approve', {
        contract: approval.token,
        functionName: 'approve',
        args: [contract(approval.drainer).address, maxUint256],
      })
      if (!ok) return false
    }
    return true
  }

  return {
    address,
    isConnected,
    labChainId,
    labChainName,
    labConfigured,
    contracts: computed(() => ({
      lab: contract('approvalLab'),
      token: contract('finsToken'),
      audToken: contract('audToken'),
      drainerRound1: contract('drainerRound1'),
      drainerRound2: contract('drainerRound2'),
      audDrainerRound1: contract('audDrainerRound1'),
      audDrainerRound2: contract('audDrainerRound2'),
    })),
    progress,
    drainedFins,
    drainedAud,
    owedFins,
    owedAud,
    hasAnyOwed,
    balance,
    audBalance,
    badgeId,
    hasClaimedReward,
    hasClaimedFaucet,
    hasOpenLabApproval,
    pendingAction,
    actionError,
    actionNotice,
    isOnLabChain,
    refresh,
    claimRefund,
    revokeLabApprovals,
    claimFaucet: () => runAndRefresh('faucet', { contract: 'finsToken', functionName: 'claimFaucet' }),
    completeRecovery: () => runAndRefresh('recovery', { functionName: 'completeRecovery' }),
    claimCompletionReward: () => runAndRefresh('reward', { functionName: 'claimCompletionReward' }),
    approveRound1Lure,
    claimLure: () => runAndRefresh('lure-claim', { contract: 'fakeAirdrop', functionName: 'claim' }),
  }
}
