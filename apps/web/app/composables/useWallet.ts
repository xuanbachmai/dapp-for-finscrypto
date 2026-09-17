import type { Connector } from '@wagmi/core'
import { useAccount, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from '@wagmi/vue'
import {
  WalletConnectionCancelledError,
  formatWalletConnectorError,
} from '../utils/walletErrors'

interface WalletConnectorOption {
  id: string
  label: string
  description: string
  icon: string
  connector: Connector
}

interface PendingConnectionRequest {
  promise: Promise<void>
  reject: (error: Error) => void
  resolve: () => void
  targetChainId?: number
}

const CONNECTOR_METADATA = {
  metaMask: {
    label: 'MetaMask',
    description: 'Connect with the MetaMask browser extension.',
    icon: 'i-lucide-wallet',
  },
  browserWallet: {
    label: 'Other Browser Wallet',
    description: 'Use another installed browser wallet such as Trust Wallet.',
    icon: 'i-lucide-wallet-cards',
  },
  walletConnect: {
    label: 'WalletConnect',
    description: 'Scan a QR code or use a supported mobile wallet.',
    icon: 'i-lucide-smartphone',
  },
} as const

let pendingConnectionRequest: PendingConnectionRequest | null = null

function createPendingConnectionRequest(targetChainId?: number) {
  let resolve!: () => void
  let reject!: (error: Error) => void

  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject, targetChainId }
}

export function useWallet() {
  const { address, chainId, isConnected } = useAccount()
  const { connector: currentConnector } = useConnection()
  const connectors = useConnectors()
  const { connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()

  const pickerOpen = useState('wallet-picker-open', () => false)
  const pickerError = useState('wallet-picker-error', () => '')
  const pendingConnectorId = useState<string | null>('wallet-picker-pending-connector-id', () => null)

  const connectorOptions = computed<WalletConnectorOption[]>(() =>
    connectors.value.flatMap((connector) => {
      const metadata = CONNECTOR_METADATA[connector.id as keyof typeof CONNECTOR_METADATA]

      if (!metadata) {
        return []
      }

      return [{
        id: connector.id,
        label: metadata.label,
        description: metadata.description,
        icon: metadata.icon,
        connector,
      }]
    }),
  )

  const currentConnectorLabel = computed(() => {
    const connectorId = currentConnector.value?.id as keyof typeof CONNECTOR_METADATA | undefined

    if (!connectorId) {
      return null
    }

    return CONNECTOR_METADATA[connectorId]?.label ?? currentConnector.value?.name ?? null
  })

  function clearPendingConnectionRequest() {
    pendingConnectionRequest = null
  }

  function getRequestedChainId(targetChainId?: number) {
    if (targetChainId) {
      return targetChainId
    }

    return pendingConnectionRequest?.targetChainId
  }

  async function connect(targetChainId?: number) {
    pickerError.value = ''

    if (pendingConnectionRequest) {
      if (targetChainId) {
        pendingConnectionRequest.targetChainId = targetChainId
      }

      pickerOpen.value = true
      return pendingConnectionRequest.promise
    }

    if (!import.meta.client) {
      throw new Error('Wallet connections are only available in the browser.')
    }

    if (isConnected.value) {
      if (targetChainId && chainId.value !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId })
      }

      return
    }

    pendingConnectionRequest = createPendingConnectionRequest(targetChainId)
    pickerOpen.value = true

    return pendingConnectionRequest.promise
  }

  async function connectWith(connectorId: string, targetChainId?: number) {
    const option = connectorOptions.value.find(item => item.id === connectorId)

    if (!option) {
      pickerError.value = 'The selected wallet is not available right now.'
      return
    }

    pickerError.value = ''
    pendingConnectorId.value = connectorId

    try {
      const connection = await connectAsync({
        connector: option.connector,
      })

      const requestedChainId = getRequestedChainId(targetChainId)

      if (requestedChainId && connection.chainId !== requestedChainId) {
        await switchChainAsync({ chainId: requestedChainId })
      }

      pickerOpen.value = false
      pendingConnectorId.value = null
      pendingConnectionRequest?.resolve()
      clearPendingConnectionRequest()
    } catch (error) {
      pendingConnectorId.value = null
      pickerError.value = formatWalletConnectorError(error)

      if (targetChainId) {
        pickerOpen.value = false
        pendingConnectionRequest?.reject(error instanceof Error ? error : new Error('Wallet connection failed.'))
        clearPendingConnectionRequest()
      }
    }
  }

  function cancelConnect() {
    pickerOpen.value = false
    pickerError.value = ''
    pendingConnectorId.value = null

    if (pendingConnectionRequest) {
      pendingConnectionRequest.reject(new WalletConnectionCancelledError())
      clearPendingConnectionRequest()
    }
  }

  async function disconnect() {
    cancelConnect()
    await disconnectAsync()
  }

  async function switchChain(chainId: number) {
    await switchChainAsync({ chainId })
  }

  return {
    address,
    chainId,
    isConnected,
    connect,
    connectWith,
    disconnect,
    switchChain,
    pickerOpen,
    pickerError,
    pendingConnectorId,
    connectorOptions,
    currentConnector,
    currentConnectorLabel,
    cancelConnect,
  }
}
