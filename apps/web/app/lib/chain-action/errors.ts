import type { ChainActionFailureReason } from '../../utils/schemas'
import { isWalletConnectionCancelledError } from '../../utils/walletErrors'

export class ChainActionError extends Error {
  constructor(readonly reason: ChainActionFailureReason, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ChainActionError'
  }
}

export function walletActionFailureReason(error: unknown): ChainActionFailureReason | undefined {
  if (isWalletConnectionCancelledError(error)) return 'connection-cancelled'
  if (!(error instanceof Error)) return undefined
  const message = error.message.toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) return 'user-rejected'
  if (message.includes('insufficient funds')) return 'insufficient-funds'
}

export function formatWalletActionError(error: unknown, insufficientFundsMessage: string) {
  switch (walletActionFailureReason(error)) {
    case 'connection-cancelled': return 'Wallet connection was cancelled.'
    case 'user-rejected': return 'Transaction was rejected in your wallet.'
    case 'insufficient-funds': return insufficientFundsMessage
    default: return error instanceof Error ? error.message : 'Transaction failed.'
  }
}
