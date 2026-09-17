import { defineChain } from 'viem'
import { base, baseSepolia, sepolia } from 'viem/chains'

export const finscrypto = defineChain({
  id: 36_475_547,
  name: 'FINSCRYPTO',
  nativeCurrency: {
    name: 'FINS',
    symbol: 'FINS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.finscrypto.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'FINSCRYPTO Explorer',
      url: 'https://explorer.finscrypto.xyz/',
    },
  },
  testnet: false,
})

/**
 * Local Anvil Chain for this standalone build. The Approval & Drain Lab is specced for
 * Sepolia; on the course platform it moves there and this entry goes away.
 */
export const localAnvil = defineChain({
  id: 31_337,
  name: 'Anvil (local)',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  testnet: true,
})

export const LAB_CHAIN_ID = localAnvil.id

export const supportedChains = [sepolia, base, baseSepolia, finscrypto, localAnvil] as const
export type SupportedChainId = (typeof supportedChains)[number]['id']
