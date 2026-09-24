import { base, baseSepolia, sepolia } from 'viem/chains'

export const LAB_CHAIN = sepolia
export const LAB_CHAIN_ID = sepolia.id

export const supportedChains = [sepolia, base, baseSepolia] as const
export type SupportedChainId = (typeof supportedChains)[number]['id']
