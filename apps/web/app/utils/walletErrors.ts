export const WALLET_CONNECTION_CANCELLED_CODE = 'WALLET_CONNECTION_CANCELLED'

export class WalletConnectionCancelledError extends Error {
  code = WALLET_CONNECTION_CANCELLED_CODE

  constructor(message = 'Wallet connection was cancelled.') {
    super(message)
    this.name = 'WalletConnectionCancelledError'
  }
}

export function isWalletConnectionCancelledError(error: unknown): error is WalletConnectionCancelledError {
  return error instanceof WalletConnectionCancelledError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === WALLET_CONNECTION_CANCELLED_CODE)
}

export function formatWalletConnectorError(error: unknown) {
  if (isWalletConnectionCancelledError(error)) {
    return 'Wallet connection was cancelled.'
  }

  if (!(error instanceof Error)) {
    return 'Unable to connect to the selected wallet.'
  }

  const loweredMessage = error.message.toLowerCase()

  if (loweredMessage.includes('user rejected') || loweredMessage.includes('user denied')) {
    return 'Connection request was rejected in your wallet.'
  }

  if (loweredMessage.includes('provider not found')) {
    return 'This wallet is not available in your browser right now.'
  }

  return error.message || 'Unable to connect to the selected wallet.'
}
