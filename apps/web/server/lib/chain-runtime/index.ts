import type { ChainRuntimeConfig, ChainRuntimeError } from '../../../app/utils/schemas'

// Same shape as the course platform's Chain runtime. The platform maps Sepolia, Base,
// Base Sepolia and FINSCRYPTO here, with Faucet signers; this build reads local Anvil and FINSCRYPTO.
const chains = {
  31337: { rpcUrl: 'localRpcUrl' },
  36475547: { rpcUrl: 'finscryptoRpcUrl' },
} as const satisfies Record<number, { rpcUrl: keyof ChainRuntimeConfig }>

export function createChainRuntime<Provider extends { getNetwork(): Promise<{ chainId: bigint }> }>(
  config: ChainRuntimeConfig,
  adapters: {
    createProvider(rpcUrl: string): Provider
  },
) {
  const providers = new Map<number, Promise<ChainRuntimeError | { status: 'ready', provider: Provider }>>()

  async function getProvider(chainId: number): Promise<ChainRuntimeError | { status: 'ready', provider: Provider }> {
    const chain = chains[chainId as keyof typeof chains]
    const rpcUrl = chain && config[chain.rpcUrl]
    if (!rpcUrl) {
      return { status: 'missing_config', chainId, setting: chain?.rpcUrl ?? 'chainId' }
    }

    if (!providers.has(chainId)) {
      const initialization = (async () => {
        const provider = adapters.createProvider(rpcUrl)
        const network = await provider.getNetwork()
        if (network.chainId !== BigInt(chainId)) {
          return { status: 'wrong_chain', chainId, actualChainId: network.chainId.toString() } as const
        }
        return { status: 'ready', provider } as const
      })()
      providers.set(chainId, initialization)
      // Retry transport failures on the next call; configuration verdicts remain memoised.
      void initialization.catch(() => providers.delete(chainId))
    }

    return providers.get(chainId)!
  }

  return { getProvider }
}
