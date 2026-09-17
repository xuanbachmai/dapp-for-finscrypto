import { useConfig } from '@wagmi/vue'
import { computed, shallowRef } from 'vue'
import { approvalId, createApprovalsScan } from '../lib/approvals-scan'
import { createWagmiApprovalReader } from '../lib/approvals-scan/wagmi'
import { useWagmiChainWriter } from '../lib/chain-action/wagmi'
import { erc20Abi } from 'viem'
import { supportedChains, type SupportedChainId } from '../utils/chains'
import type { LiveApproval } from '../utils/schemas'
import { useChainAction } from './useChainAction'
import { useWallet } from './useWallet'

const setApprovalForAllAbi = [{
  type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable',
  inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [],
}] as const

export function useApprovals() {
  const config = useConfig()
  const wallet = useWallet()
  const { address, isConnected } = wallet
  // Writers use wagmi composables, which only resolve during setup, so build one per Chain here.
  const writers = new Map(supportedChains.map(chain => [chain.id, useWagmiChainWriter(chain.id)]))

  const selectedChainIds = shallowRef<SupportedChainId[]>(supportedChains.map(chain => chain.id))
  const approvals = shallowRef<LiveApproval[]>([])
  const scanning = shallowRef(false)
  const scanned = shallowRef(false)
  const status = shallowRef('')
  const failures = shallowRef<string[]>([])
  const revoking = shallowRef<string | null>(null)
  const revokeError = shallowRef('')

  const unlimitedCount = computed(() => approvals.value.filter(item => item.unlimited || item.kind === 'nft').length)
  const atRiskCount = computed(() => approvals.value.filter(item => item.balance > 0n || item.kind === 'nft').length)

  async function scan() {
    if (!address.value) return
    const owner = address.value
    scanning.value = true
    scanned.value = false
    approvals.value = []
    failures.value = []

    for (const chainId of selectedChainIds.value) {
      const chain = supportedChains.find(item => item.id === chainId)!
      status.value = `Scanning ${chain.name}...`
      try {
        const found = await createApprovalsScan({ chainId, reader: createWagmiApprovalReader(config, chainId) }).scan(owner)
        approvals.value = [...approvals.value, ...found]
      } catch (error) {
        failures.value = [...failures.value, `${chain.name}: ${error instanceof Error ? error.message : 'scan failed'}`]
      }
    }

    status.value = ''
    scanning.value = false
    scanned.value = true
  }

  async function revoke(approval: LiveApproval) {
    const id = approvalId(approval)
    revoking.value = id
    revokeError.value = ''
    const contract = approval.kind === 'erc20'
      ? { address: approval.token, abi: erc20Abi }
      : { address: approval.token, abi: setApprovalForAllAbi }
    const action = useChainAction(contract, approval.chainId as SupportedChainId, {
      wallet, writer: writers.get(approval.chainId as SupportedChainId),
    })

    try {
      await action.run('revoke', approval.kind === 'erc20'
        ? { functionName: 'approve', args: [approval.spender, 0n] }
        : { functionName: 'setApprovalForAll', args: [approval.spender, false] })
      // Confirmed on-chain, so drop the row rather than re-scanning every Chain.
      approvals.value = approvals.value.filter(item => approvalId(item) !== id)
    } catch {
      revokeError.value = action.error.value
    } finally {
      revoking.value = null
    }
  }

  return {
    address,
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
  }
}
