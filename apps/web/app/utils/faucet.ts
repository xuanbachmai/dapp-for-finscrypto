import { LAB_CHAIN_ID } from './chains'
import type { FaucetChainConfig } from './schemas'

const DAY_IN_MS = 24 * 60 * 60 * 1_000

export const faucetChainConfig = {
  [LAB_CHAIN_ID]: {
    enabled: false,
    amountEth: '0',
    cooldownMs: DAY_IN_MS,
  },
} satisfies Record<typeof LAB_CHAIN_ID, FaucetChainConfig>

export function getFaucetChainConfig(chainId: number): FaucetChainConfig {
  const policy = faucetChainConfig[chainId as typeof LAB_CHAIN_ID]
  if (!policy) throw createError({ statusCode: 400, message: `Unsupported chain ID: ${chainId}` })
  return policy
}
