import { supportedChains, type SupportedChainId } from './chains'

export interface ChainBadge {
  label: string
  color: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle'
  icon?: string
}

export function getChainLabel(chainId: SupportedChainId | number | null) {
  if (!chainId) {
    return 'Chain TBA'
  }

  if (chainId === 84532) {
    return 'Base Sepolia'
  }

  return supportedChains.find((chain) => chain.id === chainId)?.name ?? `Chain ${chainId}`
}

export function getChainBadge(chainId: number | null): ChainBadge {
  if (!chainId) {
    return { label: 'Chain TBA', color: 'neutral', variant: 'subtle', icon: 'i-lucide-network' }
  }

  if (chainId === 11155111) {
    return { label: getChainLabel(chainId), color: 'info', variant: 'subtle', icon: 'i-lucide-network' }
  }

  if (chainId === 8453) {
    return { label: getChainLabel(chainId), color: 'error', variant: 'subtle', icon: 'i-lucide-network' }
  }

  if (chainId === 84532) {
    return { label: getChainLabel(chainId), color: 'warning', variant: 'subtle', icon: 'i-lucide-network' }
  }

  return { label: getChainLabel(chainId), color: 'neutral', variant: 'subtle', icon: 'i-lucide-network' }
}
