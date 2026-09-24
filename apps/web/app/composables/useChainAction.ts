import { computed, shallowRef } from 'vue'
import { ChainActionError, formatWalletActionError, walletActionFailureReason } from '../lib/chain-action/errors'
import { useWagmiChainWriter } from '../lib/chain-action/wagmi'
import { supportedChains, type SupportedChainId } from '../utils/chains'
import type { ContractConfig } from '../utils/contracts'
import type { ChainActionHash, ChainActionRequest, ChainWriter } from '../utils/schemas'
import { useWallet } from './useWallet'

export { ChainActionError } from '../lib/chain-action/errors'

export function useChainAction(
  contract: ContractConfig,
  chainId: SupportedChainId,
  options: {
    writer?: ChainWriter
    wallet?: Pick<ReturnType<typeof useWallet>, 'chainId' | 'isConnected' | 'connect' | 'switchChain'>
    messages?: {
      submitted?: string | ((label: string) => string)
      confirmed?: string | ((label: string) => string)
      insufficientFunds?: string
    }
    resolveContract?: (name: string) => ContractConfig
  } = {},
) {
  const wallet = options.wallet ?? useWallet()
  const writer = options.writer ?? useWagmiChainWriter(chainId)
  const chain = supportedChains.find((item) => item.id === chainId)!
  const pending = shallowRef<string | null>(null)
  const error = shallowRef('')
  const notice = shallowRef('')
  const txHash = shallowRef<ChainActionHash>()
  const isOnSupportedChain = computed(() => wallet.chainId.value === chainId)
  const explorerUrl = computed(() => txHash.value && chain.blockExplorers
    ? `${chain.blockExplorers.default.url.replace(/\/$/, '')}/tx/${txHash.value}`
    : null)

  async function ensureWalletReady() {
    if (!wallet.isConnected.value) await wallet.connect()
    if (!wallet.isConnected.value) {
      throw new ChainActionError('wallet-not-connected', 'Connect your wallet before submitting a transaction.')
    }
    if (!isOnSupportedChain.value) await wallet.switchChain(chainId)
    if (!isOnSupportedChain.value) {
      throw new ChainActionError('wrong-chain', `Switch your wallet to ${chain.name} before submitting a transaction.`)
    }
  }

  async function run(label: string, request: ChainActionRequest) {
    if (pending.value !== null) {
      throw new ChainActionError('pending', 'A transaction is already pending. Wait for confirmation before submitting another.')
    }

    pending.value = label
    error.value = ''
    notice.value = ''
    let waitingForReceipt = false

    try {
      await ensureWalletReady()
      const { contract: override, ...variables } = request
      const target = override ? options.resolveContract?.(override) : contract
      if (!target) throw new Error(`Contract ${override} is not configured.`)
      const hash = await writer.write({
        ...target,
        ...variables,
        chainId,
      })
      txHash.value = hash
      const submitted = options.messages?.submitted
      notice.value = typeof submitted === 'function'
        ? submitted(label)
        : submitted ?? 'Transaction submitted. Waiting for confirmation...'
      waitingForReceipt = true
      const status = await writer.waitForReceipt(hash)
      if (status !== 'success') throw new ChainActionError('receipt-failed', 'Transaction failed.')
      const confirmed = options.messages?.confirmed
      notice.value = typeof confirmed === 'function'
        ? confirmed(label)
        : confirmed ?? `Transaction confirmed on ${chain.name}.`
      return hash
    } catch (cause) {
      const failure = cause instanceof ChainActionError ? cause : new ChainActionError(
        walletActionFailureReason(cause) ?? (waitingForReceipt ? 'receipt-failed' : 'failed'),
        formatWalletActionError(cause, options.messages?.insufficientFunds ?? 'Your wallet does not have enough ETH for this transaction.'),
        { cause },
      )
      error.value = failure.message
      throw failure
    } finally {
      pending.value = null
    }
  }

  return { run, pending, error, notice, txHash, explorerUrl, isOnSupportedChain, ensureWalletReady }
}
