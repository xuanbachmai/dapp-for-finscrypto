import { useReadContract } from '@wagmi/vue'
import { computed } from 'vue'
import { useWagmiChainWriter } from '~/lib/chain-action/wagmi'
import { LAB_CHAIN, LAB_CHAIN_ID } from '~/utils/chains'
import { createLabContracts, getLabContract, type LabContractName } from '~/utils/contracts'
import { zeroAddress } from 'viem'
import type { ChainActionRequest } from '~/utils/schemas'
import { useChainAction } from './useChainAction'
import { useWallet } from './useWallet'

const READ_REFRESH_INTERVAL_MS = 4_000

/**
 * The Survivor Credential reward, as its own dapp. It reads completion from ApprovalLab and,
 * once complete, lets the Student mint 500 FINS + the soulbound "I Survived" badge from
 * the separate SurvivorBadge contract.
 */
export function useSurvivorBadge() {
  const wallet = useWallet()
  const { address, isConnected } = wallet
  const config = useRuntimeConfig()
  const labChainId = computed(() => LAB_CHAIN_ID)
  const labChainName = computed(() => LAB_CHAIN.name)
  const contracts = createLabContracts(config.public.labContracts)
  const contract = (name: LabContractName) => getLabContract(contracts, name)
  const badge = contract('survivorBadge')
  const lab = contract('approvalLab')
  const configured = badge.address !== zeroAddress && lab.address !== zeroAddress
  const configurationError = shallowRef('')

  const action = useChainAction(badge, LAB_CHAIN_ID, {
    wallet,
    writer: useWagmiChainWriter(LAB_CHAIN_ID),
    resolveContract: name => contract(name as LabContractName),
    messages: { submitted: 'Submitted. Waiting for confirmation...', confirmed: 'Reward claimed.' },
  })

  const read = (address_: `0x${string}`, abi: any, functionName: string) =>
    useReadContract(computed(() => ({
      address: address_,
      abi,
      chainId: labChainId.value,
      functionName,
      args: address.value ? [address.value] : undefined,
      query: { enabled: Boolean(address.value) && configured, refetchInterval: READ_REFRESH_INTERVAL_MS },
    })))

  const labCompleteQuery = read(lab.address, lab.abi, 'hasCompleted')
  const badgeIdQuery = read(badge.address, badge.abi, 'badgeOf')

  const labComplete = computed(() => Boolean(labCompleteQuery.data.value))
  const badgeId = computed(() => (badgeIdQuery.data.value as bigint | undefined) ?? 0n)
  const hasClaimedReward = computed(() => badgeId.value > 0n)

  const pendingAction = computed(() => action.pending.value)
  const actionError = computed(() => configurationError.value || action.error.value)
  const actionNotice = computed(() => action.notice.value)
  const isOnLabChain = computed(() => action.isOnSupportedChain.value)

  async function refresh() {
    await Promise.allSettled([labCompleteQuery.refetch(), badgeIdQuery.refetch()])
  }

  async function claimReward() {
    if (!configured) {
      configurationError.value = 'The Survivor Badge contract has not been deployed or configured on Sepolia yet.'
      return false
    }
    configurationError.value = ''
    const request: ChainActionRequest = { functionName: 'claim' }
    try {
      await action.run('reward', request)
      return true
    }
    catch {
      return false
    }
    finally {
      await refresh()
    }
  }

  return {
    address,
    isConnected,
    configured,
    labChainId,
    labChainName,
    badgeAddress: computed(() => badge.address),
    labComplete,
    badgeId,
    hasClaimedReward,
    pendingAction,
    actionError,
    actionNotice,
    isOnLabChain,
    refresh,
    claimReward,
  }
}
